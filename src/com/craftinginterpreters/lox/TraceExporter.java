package com.craftinginterpreters.lox;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Runs a Lox program and records what happened as JSON, for the frontend
 * visualizer in ../frontend.
 *
 * The output is one object:
 *
 *   { "tokens": [...], "ast": {...} | null, "trace": [...], "notice": string | null }
 *
 * and each entry in "trace" is one step:
 *
 *   { "phase": "scan" | "parse" | "interpret",
 *     "line": number | null,        1-based source line to highlight
 *     "tokenIndex": number | null,  token to highlight (scan phase)
 *     "astNodeId": string | null,   AST node to highlight (parse + interpret)
 *     "stack": string[],            visitor call stack, outermost first
 *     "scopes": [{ name, vars: [{ name, value, type }] }],  global first
 *     "output": string[],           cumulative stdout so far
 *     "commentary": string,         narration for the guided walkthrough
 *     "error": null | { line, message } }
 *
 * Every step carries the COMPLETE state at that moment rather than a delta. That
 * is redundant on the wire, but it makes stepping backwards in the UI a matter of
 * decrementing an index, with no undo logic anywhere.
 *
 * Nothing here changes how the interpreter evaluates a program. Scanning and
 * parsing are observed after the fact, and interpretation is observed through
 * {@link Interpreter.Probe}, which only reads state.
 */
final class TraceExporter {

  /** Longest program we will trace. Guards against a huge POST body. */
  static final int MAX_SOURCE_CHARS = 20_000;

  /**
   * Cap on recorded steps. Lox at this stage has no functions, file access or
   * network access, so the one way a submitted program can misbehave is looping
   * forever -- `while (true) { }`. Hitting this cap aborts the walk and marks the
   * trace as truncated.
   */
  private static final int MAX_STEPS = 4000;

  /** Thrown to unwind out of the interpreter once MAX_STEPS is reached. */
  private static final class StepLimitReached extends RuntimeException {
    StepLimitReached() {
      super(null, null, false, false); // no message, no stack trace: pure control flow
    }
  }

  /** One scanner, parser or runtime error, waiting to be turned into a step. */
  private static final class Diagnostic {
    final int line;
    final String message;

    Diagnostic(int line, String message) {
      this.line = line;
      this.message = message;
    }
  }

  private final List<String> steps = new ArrayList<>();   // serialized steps
  private final List<String> output = new ArrayList<>();  // stdout so far
  private final List<String> visitorStack = new ArrayList<>();  // outermost first
  private final List<String> blockLabels = new ArrayList<>();   // outermost first
  private final List<Diagnostic> pending = new ArrayList<>();

  private final Map<Object, String> nodeIds = new IdentityHashMap<>();
  private final Map<Object, Integer> nodeLines = new IdentityHashMap<>();

  private Interpreter interpreter = new Interpreter();
  private Map<Object, Integer> parserLines = Collections.emptyMap();
  private Set<Stmt> desugaredForLoops = Collections.emptySet();

  private int nextNodeId = 0;
  private int errorCount = 0;
  private boolean truncated = false;

  private TraceExporter() {}

  /** Scan, parse and interpret `source`, returning the visualizer's JSON bundle. */
  static String export(String source) {
    return new TraceExporter().run(source);
  }

  // ---------------------------------------------------------------------------
  // Pipeline
  // ---------------------------------------------------------------------------

  private String run(String source) {
    // Lox reports errors through static helpers, so redirect them here for the
    // duration of this run instead of losing them to stderr. Restored in the
    // finally clause so the CLI is unaffected.
    Lox.resetErrors();
    Lox.diagnostics = this::collect;
    try {
      return trace(source);
    } finally {
      Lox.diagnostics = null;
      Lox.resetErrors();
    }
  }

  private String trace(String source) {
    // ---- Phase 1: scanning --------------------------------------------------
    List<Token> tokens = new Scanner(source).scanTokens();
    recordScanSteps(tokens);
    flushDiagnostics("scan");

    String tokensJson = tokensJson(tokens);
    if (Lox.hadError) {
      return bundle(tokensJson, "null",
          "Scanning failed, so there is nothing to parse. See the console.");
    }

    // ---- Phase 2: parsing ---------------------------------------------------
    Parser parser = new Parser(tokens);
    List<Stmt> statements;
    try {
      statements = parser.parse();
    } catch (StackOverflowError overflow) {
      // Recursive descent recurses once per nesting level, so an absurdly nested
      // expression can exhaust the Java stack before any Lox error is raised.
      collect(1, "Expression nested too deeply to parse.");
      flushDiagnostics("parse");
      return bundle(tokensJson, "null", "The program is nested too deeply to parse.");
    }

    parserLines = parser.sourceLines;
    desugaredForLoops = parser.desugaredForLoops;

    String astJson = buildAst(statements);
    recordParseSteps(statements);
    flushDiagnostics("parse");

    if (Lox.hadError) {
      return bundle(tokensJson, astJson,
          "Parsing found " + errorCount + (errorCount == 1 ? " error" : " errors")
              + ", so the program was not run. See the console.");
    }

    // ---- Phase 3: interpreting ---------------------------------------------
    interpreter.setProbe(new Interpreter.Probe() {
      @Override public void enter(String visitor, Object node) { onEnter(visitor, node); }
      @Override public void exit(String visitor, Object node, Object result) { onExit(visitor, node, result); }
      @Override public void printed(String text) { output.add(text); }
      @Override public void failed(RuntimeError error) { onFailed(); }
    });

    try {
      interpreter.interpret(statements);
    } catch (StepLimitReached limit) {
      truncated = true;
    } catch (StackOverflowError overflow) {
      visitorStack.clear();
      collect(1, "Evaluation nested too deeply \u2014 the Java call stack ran out.");
    } finally {
      interpreter.setProbe(null);
    }
    flushDiagnostics("interpret");

    String notice = null;
    if (truncated) {
      visitorStack.clear();
      appendStep("interpret", null, null, null,
          "Trace stopped here: this program produced more than " + MAX_STEPS
              + " steps, which usually means a loop that never ends.",
          "null");
      notice = "Stopped after " + MAX_STEPS + " steps. The program may loop forever; "
          + "the trace above shows how it got that far.";
    } else if (errorCount > 0) {
      notice = "The program stopped with a runtime error. See the console.";
    }

    return bundle(tokensJson, astJson, notice);
  }

  private String bundle(String tokensJson, String astJson, String notice) {
    return Json.object(Arrays.asList(
        Json.member("tokens", tokensJson),
        Json.member("ast", astJson),
        Json.member("trace", Json.array(steps)),
        Json.member("notice", notice == null ? "null" : Json.string(notice))));
  }

  // ---------------------------------------------------------------------------
  // Phase 1: scanning
  // ---------------------------------------------------------------------------

  private void recordScanSteps(List<Token> tokens) {
    addStep("scan", 1, null, null,
        "The scanner walks the source one character at a time. It has no idea what the "
            + "program means \u2014 it only groups characters into tokens, turning a stream of "
            + "letters into a stream of words.",
        "null");

    for (int i = 0; i < tokens.size(); i++) {
      Token token = tokens.get(i);
      addStep("scan", token.line, i, null, scanCommentary(token, tokens.size()), "null");
    }
  }

  private String scanCommentary(Token token, int total) {
    switch (token.type) {
      case EOF:
        return "End of input, after " + (total - 1) + " real tokens. The scanner appends an "
            + "EOF token so the parser knows when to stop instead of running off the end of "
            + "the list.";
      case IDENTIFIER:
        return "'" + token.lexeme + "' is not in the keywords map, so it stays an IDENTIFIER. "
            + "The scanner does not check whether it has been declared \u2014 that is a runtime concern.";
      case NUMBER:
        return "'" + token.lexeme + "' becomes a NUMBER token carrying the literal "
            + token.literal + ". Lox stores every number as a Java double, and the trailing "
            + "'.0' is trimmed at print time.";
      case STRING:
        return "The scanner consumed characters until the closing quote. The literal is the text "
            + "without the quotes: \"" + token.literal + "\".";
      default:
        // Keywords start with a letter; everything left is an operator or punctuation.
        boolean isKeyword = !token.lexeme.isEmpty()
            && Character.isLetter(token.lexeme.charAt(0));
        if (isKeyword) {
          return "'" + token.lexeme + "' IS in the keywords map, so it becomes a "
              + token.type + " token rather than an IDENTIFIER. That single map lookup is all "
              + "there is to keywords.";
        }
        return "'" + token.lexeme + "' is punctuation, scanned into a " + token.type
            + " token. The scanner does not care whether it appears in a sensible place.";
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2: parsing
  // ---------------------------------------------------------------------------

  private void recordParseSteps(List<Stmt> statements) {
    addStep("parse", 1, null, "program",
        "The parser turns the flat token list into a nested tree. It works by recursive "
            + "descent: one Java method per grammar rule, calling each other to work out which "
            + "statements and expressions belong inside which.",
        "null");

    for (Stmt statement : statements) {
      if (statement == null) continue; // the parser recovered from an error here
      addStep("parse", nodeLines.get(statement), null, nodeIds.get(statement),
          parseCommentary(statement), "null");
    }

    addStep("parse", null, null, "program",
        "Parsing complete \u2014 the AST is fully built. From here the interpreter's job is "
            + "simply walking these nodes.",
        "null");
  }

  private String parseCommentary(Stmt statement) {
    String kind = kindOf(statement);

    if (desugaredForLoops.contains(statement)) {
      return "This came from a `for` loop \u2014 and notice there is no Stmt.For node anywhere. "
          + "forStatement() DESUGARS the loop into a " + kind + " wrapped around a Stmt.While, "
          + "so the interpreter only ever has to know how to run a while loop.";
    }
    if (statement instanceof Stmt.Var) {
      return "The parser saw a VAR token and called varDeclaration(), producing a " + kind
          + " for `" + ((Stmt.Var) statement).name.lexeme + "`. Once the node exists, the shape "
          + "of this declaration is fixed permanently.";
    }
    if (statement instanceof Stmt.Print) {
      return "printStatement() produced a " + kind + ". Its child is whatever expression() "
          + "returned, and operator precedence is already baked into that subtree's shape.";
    }
    if (statement instanceof Stmt.Block) {
      int count = ((Stmt.Block) statement).statements.size();
      return "A '{' sent the parser into block(), which parsed " + count
          + (count == 1 ? " statement" : " statements") + " until the matching '}' and wrapped "
          + "them in a " + kind + ".";
    }
    if (statement instanceof Stmt.If) {
      return "ifStatement() produced a " + kind + ": a condition plus one or two branches. "
          + "Nothing has been evaluated \u2014 the tree only records the structure.";
    }
    if (statement instanceof Stmt.While) {
      return "whileStatement() produced a " + kind + " holding a condition and a body. The "
          + "repetition itself is the interpreter's problem, not the parser's.";
    }
    return "expressionStatement() produced a " + kind + ".";
  }

  // ---------------------------------------------------------------------------
  // Building the AST JSON
  // ---------------------------------------------------------------------------

  private String buildAst(List<Stmt> statements) {
    List<String> children = new ArrayList<>();
    for (Stmt statement : statements) {
      if (statement == null) continue;
      children.add(buildNode(statement, 1));
    }
    return nodeJson("program", "Program", "List<Stmt>", 1, children);
  }

  /**
   * Serialize one node and, recursively, its children -- assigning the stable id
   * that trace steps refer to via `astNodeId`. Ids are handed out here and only
   * here, so the tree and the trace can never disagree about which node is which.
   */
  private String buildNode(Object node, int parentLine) {
    String id = "n" + (nextNodeId++);
    nodeIds.put(node, id);

    int line = lineOf(node, parentLine);
    nodeLines.put(node, line);

    List<String> children = new ArrayList<>();
    for (Object child : childrenOf(node)) {
      children.add(buildNode(child, line));
    }

    return nodeJson(id, kindOf(node), detailOf(node), line, children);
  }

  private static String nodeJson(String id, String type, String detail, int line,
                                 List<String> children) {
    return Json.object(Arrays.asList(
        Json.member("id", Json.string(id)),
        Json.member("type", Json.string(type)),
        Json.member("label", Json.string(type)),
        Json.member("detail", Json.string(detail)),
        Json.member("line", Integer.toString(line)),
        Json.member("children", Json.array(children))));
  }

  /** "Stmt.Var", "Expr.Binary" -- matching the Java class the node really is. */
  private static String kindOf(Object node) {
    return ((node instanceof Expr) ? "Expr." : "Stmt.") + node.getClass().getSimpleName();
  }

  /** The short annotation shown beside a node's name in the AST panel. */
  private String detailOf(Object node) {
    if (desugaredForLoops.contains(node)) return "desugared for loop";

    if (node instanceof Stmt.Var) {
      return "name = \"" + ((Stmt.Var) node).name.lexeme + "\"";
    }
    if (node instanceof Stmt.Block) {
      int count = ((Stmt.Block) node).statements.size();
      return count + (count == 1 ? " statement" : " statements");
    }
    if (node instanceof Stmt.If) {
      return ((Stmt.If) node).elseBranch == null ? "elseBranch = null" : "has else branch";
    }
    if (node instanceof Expr.Binary) {
      return "operator = " + ((Expr.Binary) node).operator.lexeme;
    }
    if (node instanceof Expr.Logical) {
      return "operator = " + ((Expr.Logical) node).operator.lexeme;
    }
    if (node instanceof Expr.Unary) {
      return "operator = " + ((Expr.Unary) node).operator.lexeme;
    }
    if (node instanceof Expr.Assign) {
      return "name = \"" + ((Expr.Assign) node).name.lexeme + "\"";
    }
    if (node instanceof Expr.Variable) {
      return ((Expr.Variable) node).name.lexeme;
    }
    if (node instanceof Expr.Literal) {
      return valueText(((Expr.Literal) node).value);
    }
    return "";
  }

  /**
   * Child nodes, in the order they should appear in the tree -- which is also the
   * order the interpreter visits them.
   */
  private static List<Object> childrenOf(Object node) {
    List<Object> children = new ArrayList<>();

    if (node instanceof Stmt.Block) {
      for (Stmt statement : ((Stmt.Block) node).statements) add(children, statement);
    } else if (node instanceof Stmt.Expression) {
      add(children, ((Stmt.Expression) node).expression);
    } else if (node instanceof Stmt.If) {
      Stmt.If stmt = (Stmt.If) node;
      add(children, stmt.condition);
      add(children, stmt.thenBranch);
      add(children, stmt.elseBranch);
    } else if (node instanceof Stmt.Print) {
      add(children, ((Stmt.Print) node).expression);
    } else if (node instanceof Stmt.Var) {
      add(children, ((Stmt.Var) node).initializer);
    } else if (node instanceof Stmt.While) {
      Stmt.While stmt = (Stmt.While) node;
      add(children, stmt.condition);
      add(children, stmt.body);
    } else if (node instanceof Expr.Assign) {
      add(children, ((Expr.Assign) node).value);
    } else if (node instanceof Expr.Binary) {
      Expr.Binary expr = (Expr.Binary) node;
      add(children, expr.left);
      add(children, expr.right);
    } else if (node instanceof Expr.Grouping) {
      add(children, ((Expr.Grouping) node).expression);
    } else if (node instanceof Expr.Logical) {
      Expr.Logical expr = (Expr.Logical) node;
      add(children, expr.left);
      add(children, expr.right);
    } else if (node instanceof Expr.Unary) {
      add(children, ((Expr.Unary) node).right);
    }
    // Expr.Literal and Expr.Variable are leaves.

    return children;
  }

  private static void add(List<Object> children, Object child) {
    if (child != null) children.add(child);
  }

  /**
   * The 1-based source line a node should highlight: its own token if it holds
   * one, then the line the parser recorded for it, then the first line found
   * anywhere in its subtree, and finally the enclosing node's line.
   */
  private int lineOf(Object node, int parentLine) {
    int own = tokenLine(node);
    if (own != 0) return own;

    Integer recorded = parserLines.get(node);
    if (recorded != null) return recorded;

    for (Object child : childrenOf(node)) {
      int line = lineOf(child, 0);
      if (line != 0) return line;
    }
    return parentLine;
  }

  /** The line of the Token a node carries, or 0 if it carries none. */
  private static int tokenLine(Object node) {
    if (node instanceof Stmt.Var) return ((Stmt.Var) node).name.line;
    if (node instanceof Expr.Assign) return ((Expr.Assign) node).name.line;
    if (node instanceof Expr.Variable) return ((Expr.Variable) node).name.line;
    if (node instanceof Expr.Binary) return ((Expr.Binary) node).operator.line;
    if (node instanceof Expr.Logical) return ((Expr.Logical) node).operator.line;
    if (node instanceof Expr.Unary) return ((Expr.Unary) node).operator.line;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase 3: interpreting (the Interpreter.Probe callbacks)
  // ---------------------------------------------------------------------------

  private void onEnter(String visitor, Object node) {
    visitorStack.add(visitor);
    // Push the label BEFORE the environment exists: visitBlockStmt has not run
    // yet, so the chain is still one frame short. scopesJson() only consumes as
    // many labels as there are frames, so the extra one is simply unused until
    // the block's Environment appears.
    if (visitor.equals("visitBlockStmt")) {
      blockLabels.add("block @ line " + nodeLines.get(node));
    }

    addStep("interpret", lineFor(node), null, idFor(node),
        enterCommentary(visitor, node), "null");
    stopIfTruncated();
  }

  private void onExit(String visitor, Object node, Object result) {
    // Record before popping, so the step shows the frame that is returning. By
    // now executeBlock's finally clause has already restored the environment, so
    // a block's exit step correctly shows its scope gone.
    addStep("interpret", lineFor(node), null, idFor(node),
        exitCommentary(visitor, result), "null");

    if (!visitorStack.isEmpty()) visitorStack.remove(visitorStack.size() - 1);
    if (visitor.equals("visitBlockStmt") && !blockLabels.isEmpty()) {
      blockLabels.remove(blockLabels.size() - 1);
    }
    stopIfTruncated();
  }

  /** A RuntimeError abandoned the walk, so every pending frame is gone at once. */
  private void onFailed() {
    visitorStack.clear();
    blockLabels.clear();
  }

  private String enterCommentary(String visitor, Object node) {
    switch (visitor) {
      case "interpret":
        return "interpret() loops over the top-level statements, calling execute() on each. "
            + "The global environment starts empty.";
      case "visitVarStmt":
        return "Declaring `" + ((Stmt.Var) node).name.lexeme + "`. visitVarStmt() evaluates the "
            + "initializer first, then calls environment.define() to store the result in the "
            + "current scope.";
      case "visitPrintStmt":
        return "`print` is a statement in Lox, not a library call. visitPrintStmt() evaluates "
            + "the expression, runs it through stringify(), and writes one line to stdout.";
      case "visitExpressionStmt":
        return "An expression statement: evaluate it for its side effects, then discard the value.";
      case "visitBlockStmt":
        return "A block begins. visitBlockStmt() creates a new Environment whose `enclosing` "
            + "field points at the current one \u2014 that parent pointer is all there is to nested "
            + "scoping in Lox.";
      case "visitIfStmt":
        return "visitIfStmt() evaluates the condition, then executes exactly one branch. Control "
            + "flow in a tree-walking interpreter is just Java control flow.";
      case "visitWhileStmt":
        return "visitWhileStmt() is a Java `while` loop wrapped around evaluate(condition) and "
            + "execute(body).";
      case "visitBinaryExpr":
        return "Evaluating a binary `" + ((Expr.Binary) node).operator.lexeme + "`. Lox evaluates "
            + "the left operand completely, then the right, and only then applies the operator.";
      case "visitUnaryExpr":
        return "Evaluating a unary `" + ((Expr.Unary) node).operator.lexeme
            + "`: evaluate the operand, then apply the operator to the result.";
      case "visitLogicalExpr":
        return "`" + ((Expr.Logical) node).operator.lexeme + "` short-circuits. "
            + "visitLogicalExpr() evaluates the left side and may return without ever touching "
            + "the right \u2014 which is why it can't be a plain Expr.Binary.";
      case "visitGroupingExpr":
        return "Parentheses only group. visitGroupingExpr() unwraps them and evaluates what is "
            + "inside; precedence was already settled at parse time.";
      case "visitLiteralExpr":
        return "A literal \u2014 this is where the recursion bottoms out. visitLiteralExpr() returns "
            + "the value the parser stored: " + valueText(((Expr.Literal) node).value) + ".";
      case "visitVariableExpr":
        return "Looking up `" + ((Expr.Variable) node).name.lexeme + "` with environment.get(), "
            + "which checks this scope's own map and only then follows `enclosing` outward.";
      case "visitAssignExpr":
        return "Assignment is an expression in Lox, so it produces a value. visitAssignExpr() "
            + "evaluates the right-hand side, then environment.assign() updates `"
            + ((Expr.Assign) node).name.lexeme + "` in whichever scope declared it.";
      default:
        return "Entering " + visitor + "().";
    }
  }

  private String exitCommentary(String visitor, Object result) {
    switch (visitor) {
      case "interpret":
        return "Program complete. Every frame that was pushed has returned, and every block "
            + "scope has been discarded. Step back through the trace to watch the call stack "
            + "grow and shrink.";
      case "visitVarStmt":
        return "The binding now exists in the " + currentScopeName()
            + " scope \u2014 see the Scope Stack tab.";
      case "visitPrintStmt":
        return output.isEmpty()
            ? "The line has been written to stdout."
            : "Printed `" + output.get(output.size() - 1) + "` to stdout.";
      case "visitExpressionStmt":
        return "The value is thrown away; only the side effect remains.";
      case "visitBlockStmt":
        return "The block ends. executeBlock() restores the previous environment in a `finally` "
            + "clause, so the inner scope and everything declared in it is gone.";
      case "visitIfStmt":
        return "The if statement is finished \u2014 whichever branch ran, execution continues after it.";
      case "visitWhileStmt":
        return "The condition finally evaluated to false, so visitWhileStmt() returns.";
      default:
        return visitor + "() returned " + valueText(result) + " ("
            + typeName(result) + ") to its caller.";
    }
  }

  /** Name of the innermost scope right now, for commentary. */
  private String currentScopeName() {
    return blockLabels.isEmpty() ? "global" : blockLabels.get(blockLabels.size() - 1);
  }

  // ---------------------------------------------------------------------------
  // Snapshots
  // ---------------------------------------------------------------------------

  /**
   * The environment chain, global first, matching the visualizer's `scopes`
   * field. Block frames borrow their labels from the visitBlockStmt calls we are
   * currently inside, since an Environment has no name of its own.
   */
  private String scopesJson() {
    List<Environment> chain = new ArrayList<>();
    for (Environment env = interpreter.currentEnvironment(); env != null; env = env.enclosing) {
      chain.add(env);
    }
    Collections.reverse(chain); // index 0 must be the global scope

    List<String> frames = new ArrayList<>();
    for (int i = 0; i < chain.size(); i++) {
      String name = "global";
      if (i > 0) {
        name = (i - 1 < blockLabels.size()) ? blockLabels.get(i - 1) : "block";
      }
      frames.add(frameJson(name, chain.get(i)));
    }
    return Json.array(frames);
  }

  private String frameJson(String name, Environment environment) {
    List<String> vars = new ArrayList<>();
    for (Map.Entry<String, Object> binding : environment.bindings().entrySet()) {
      Object value = binding.getValue();
      vars.add(Json.object(Arrays.asList(
          Json.member("name", Json.string(binding.getKey())),
          Json.member("value", Json.string(valueText(value))),
          Json.member("type", Json.string(typeName(value))))));
    }

    return Json.object(Arrays.asList(
        Json.member("name", Json.string(name)),
        Json.member("vars", Json.array(vars))));
  }

  private static String tokensJson(List<Token> tokens) {
    List<String> items = new ArrayList<>();
    for (Token token : tokens) {
      items.add(Json.object(Arrays.asList(
          Json.member("type", Json.string(token.type.name())),
          Json.member("lexeme", Json.string(token.lexeme)),
          Json.member("literal", Json.literal(token.literal)),
          Json.member("line", Integer.toString(token.line)))));
    }
    return Json.array(items);
  }

  /** How a Lox value reads in the panels: strings keep their quotes. */
  private String valueText(Object value) {
    if (value instanceof String) return "\"" + value + "\"";
    return interpreter.stringify(value);
  }

  /** The type name the frontend uses to colour a value. */
  private static String typeName(Object value) {
    if (value == null) return "nil";
    if (value instanceof String) return "string";
    if (value instanceof Double) return "number";
    if (value instanceof Boolean) return "boolean";
    return "value";
  }

  // ---------------------------------------------------------------------------
  // Steps and diagnostics
  // ---------------------------------------------------------------------------

  private void addStep(String phase, Integer line, Integer tokenIndex, String nodeId,
                       String commentary, String errorJson) {
    if (steps.size() >= MAX_STEPS) {
      truncated = true;
      return;
    }
    appendStep(phase, line, tokenIndex, nodeId, commentary, errorJson);
  }

  /** Append unconditionally -- used for the closing note on a truncated trace. */
  private void appendStep(String phase, Integer line, Integer tokenIndex, String nodeId,
                          String commentary, String errorJson) {
    steps.add(Json.object(Arrays.asList(
        Json.member("phase", Json.string(phase)),
        Json.member("line", line == null ? "null" : line.toString()),
        Json.member("tokenIndex", tokenIndex == null ? "null" : tokenIndex.toString()),
        Json.member("astNodeId", nodeId == null ? "null" : Json.string(nodeId)),
        Json.member("stack", stringArray(visitorStack)),
        Json.member("scopes", "interpret".equals(phase) ? scopesJson() : "[]"),
        Json.member("output", stringArray(output)),
        Json.member("commentary", Json.string(commentary)),
        Json.member("error", errorJson))));
  }

  private void stopIfTruncated() {
    if (truncated) throw new StepLimitReached();
  }

  /** Receives every diagnostic Lox reports while this exporter is installed. */
  private void collect(int line, String message) {
    pending.add(new Diagnostic(line, message));
  }

  /** Turn the diagnostics collected during a phase into trace steps. */
  private void flushDiagnostics(String phase) {
    for (Diagnostic diagnostic : pending) {
      String errorJson = Json.object(Arrays.asList(
          Json.member("line", Integer.toString(diagnostic.line)),
          Json.member("message", Json.string(diagnostic.message))));
      addStep(phase, diagnostic.line, null, null, diagnostic.message, errorJson);
      errorCount++;
    }
    pending.clear();
  }

  private Integer lineFor(Object node) {
    return node == null ? null : nodeLines.get(node);
  }

  private String idFor(Object node) {
    return node == null ? null : nodeIds.get(node);
  }

  private static String stringArray(List<String> values) {
    List<String> items = new ArrayList<>(values.size());
    for (String value : values) items.add(Json.string(value));
    return Json.array(items);
  }
}
