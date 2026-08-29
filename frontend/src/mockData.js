/**
 * mockData.js
 * Provides static execution trace data for the Lox Educational Visualizer demo.
 * Defines the AST schema, token stream, and step-by-step runtime state snapshots
 * (environment scopes, call stacks, and output buffer) for sample Lox scripts.
 */

// ---------------------------------------------------------------------------
// 1. THE SOURCE
// ---------------------------------------------------------------------------
// Exercises Chapters 1-9 of Crafting Interpreters: variables, arithmetic,
// block scoping + shadowing, if/else, while loops, and for loop desugaring.

export const SAMPLE_SOURCE = `var a = 3;
var b = 4;
print a + b;

{
  var a = "inner";
  print a;
}

if (a < b) {
  print "a is smaller";
}

var i = 0;
while (i < 2) {
  print i;
  i = i + 1;
}

for (var j = 2; j > 0; j = j - 1) {
  print j;
}`;

// ---------------------------------------------------------------------------
// 2. THE TOKEN STREAM (Output of Scanner.java)
// ---------------------------------------------------------------------------
// Lexical token stream representing the scanned Lox source program. 
// Field schema mirrors com.craftinginterpreters.lox.Token (type, lexeme, literal, line).

/** Tiny helper so the table below stays readable. */
const t = (type, lexeme, literal, line) => ({ type, lexeme, literal, line });

export const TOKENS = [
  // line 1: var a = 3;
  t("VAR", "var", null, 1),
  t("IDENTIFIER", "a", null, 1),
  t("EQUAL", "=", null, 1),
  t("NUMBER", "3", 3.0, 1),
  t("SEMICOLON", ";", null, 1),
  // line 2: var b = 4;
  t("VAR", "var", null, 2),
  t("IDENTIFIER", "b", null, 2),
  t("EQUAL", "=", null, 2),
  t("NUMBER", "4", 4.0, 2),
  t("SEMICOLON", ";", null, 2),
  // line 3: print a + b;
  t("PRINT", "print", null, 3),
  t("IDENTIFIER", "a", null, 3),
  t("PLUS", "+", null, 3),
  t("IDENTIFIER", "b", null, 3),
  t("SEMICOLON", ";", null, 3),
  // line 5: {
  t("LEFT_BRACE", "{", null, 5),
  // line 6: var a = "inner";
  t("VAR", "var", null, 6),
  t("IDENTIFIER", "a", null, 6),
  t("EQUAL", "=", null, 6),
  t("STRING", '"inner"', "inner", 6),
  t("SEMICOLON", ";", null, 6),
  // line 7: print a;
  t("PRINT", "print", null, 7),
  t("IDENTIFIER", "a", null, 7),
  t("SEMICOLON", ";", null, 7),
  // line 8: }
  t("RIGHT_BRACE", "}", null, 8),
  // line 10: if (a < b) {
  t("IF", "if", null, 10),
  t("LEFT_PAREN", "(", null, 10),
  t("IDENTIFIER", "a", null, 10),
  t("LESS", "<", null, 10),
  t("IDENTIFIER", "b", null, 10),
  t("RIGHT_PAREN", ")", null, 10),
  t("LEFT_BRACE", "{", null, 10),
  // line 11: print "a is smaller";
  t("PRINT", "print", null, 11),
  t("STRING", '"a is smaller"', "a is smaller", 11),
  t("SEMICOLON", ";", null, 11),
  // line 12: }
  t("RIGHT_BRACE", "}", null, 12),
  // line 14: var i = 0;
  t("VAR", "var", null, 14),
  t("IDENTIFIER", "i", null, 14),
  t("EQUAL", "=", null, 14),
  t("NUMBER", "0", 0.0, 14),
  t("SEMICOLON", ";", null, 14),
  // line 15: while (i < 2) {
  t("WHILE", "while", null, 15),
  t("LEFT_PAREN", "(", null, 15),
  t("IDENTIFIER", "i", null, 15),
  t("LESS", "<", null, 15),
  t("NUMBER", "2", 2.0, 15),
  t("RIGHT_PAREN", ")", null, 15),
  t("LEFT_BRACE", "{", null, 15),
  // line 16: print i;
  t("PRINT", "print", null, 16),
  t("IDENTIFIER", "i", null, 16),
  t("SEMICOLON", ";", null, 16),
  // line 17: i = i + 1;
  t("IDENTIFIER", "i", null, 17),
  t("EQUAL", "=", null, 17),
  t("IDENTIFIER", "i", null, 17),
  t("PLUS", "+", null, 17),
  t("NUMBER", "1", 1.0, 17),
  t("SEMICOLON", ";", null, 17),
  // line 18: }
  t("RIGHT_BRACE", "}", null, 18),
  // line 20: for (var j = 2; j > 0; j = j - 1) {
  t("FOR", "for", null, 20),
  t("LEFT_PAREN", "(", null, 20),
  t("VAR", "var", null, 20),
  t("IDENTIFIER", "j", null, 20),
  t("EQUAL", "=", null, 20),
  t("NUMBER", "2", 2.0, 20),
  t("SEMICOLON", ";", null, 20),
  t("IDENTIFIER", "j", null, 20),
  t("GREATER", ">", null, 20),
  t("NUMBER", "0", 0.0, 20),
  t("SEMICOLON", ";", null, 20),
  t("IDENTIFIER", "j", null, 20),
  t("EQUAL", "=", null, 20),
  t("IDENTIFIER", "j", null, 20),
  t("MINUS", "-", null, 20),
  t("NUMBER", "1", 1.0, 20),
  t("RIGHT_PAREN", ")", null, 20),
  t("LEFT_BRACE", "{", null, 20),
  // line 21: print j;
  t("PRINT", "print", null, 21),
  t("IDENTIFIER", "j", null, 21),
  t("SEMICOLON", ";", null, 21),
  // line 22: }
  t("RIGHT_BRACE", "}", null, 22),
  // End of File
  t("EOF", "", null, 22),
];

// ---------------------------------------------------------------------------
// 3. THE AST (Output of Parser.java)
// ---------------------------------------------------------------------------
// Abstract Syntax Tree output by the parser. Desugars high-level constructs 
// (e.g., 'for' loops desugared into nested Stmt.Block and Stmt.While nodes).

export const AST = {
  id: "program",
  type: "Program",
  label: "Program",
  detail: "List<Stmt>",
  line: 1,
  children: [
    {
      id: "s1", type: "Stmt.Var", label: "Stmt.Var", detail: 'name = "a"', line: 1,
      children: [{ id: "e1", type: "Expr.Literal", label: "Expr.Literal", detail: "3", line: 1, children: [] }],
    },
    {
      id: "s2", type: "Stmt.Var", label: "Stmt.Var", detail: 'name = "b"', line: 2,
      children: [{ id: "e2", type: "Expr.Literal", label: "Expr.Literal", detail: "4", line: 2, children: [] }],
    },
    {
      id: "s3", type: "Stmt.Print", label: "Stmt.Print", detail: "", line: 3,
      children: [
        {
          id: "e3", type: "Expr.Binary", label: "Expr.Binary", detail: "operator = +", line: 3,
          children: [
            { id: "e3l", type: "Expr.Variable", label: "Expr.Variable", detail: "a", line: 3, children: [] },
            { id: "e3r", type: "Expr.Variable", label: "Expr.Variable", detail: "b", line: 3, children: [] },
          ],
        },
      ],
    },
    {
      id: "s4", type: "Stmt.Block", label: "Stmt.Block", detail: "2 statements", line: 5,
      children: [
        {
          id: "s4a", type: "Stmt.Var", label: "Stmt.Var", detail: 'name = "a"  (shadows outer a)', line: 6,
          children: [{ id: "e4", type: "Expr.Literal", label: "Expr.Literal", detail: '"inner"', line: 6, children: [] }],
        },
        {
          id: "s4b", type: "Stmt.Print", label: "Stmt.Print", detail: "", line: 7,
          children: [{ id: "e5", type: "Expr.Variable", label: "Expr.Variable", detail: "a", line: 7, children: [] }],
        },
      ],
    },
    {
      id: "s5", type: "Stmt.If", label: "Stmt.If", detail: "elseBranch = null", line: 10,
      children: [
        {
          id: "e6", type: "Expr.Binary", label: "Expr.Binary", detail: "operator = <   (condition)", line: 10,
          children: [
            { id: "e6l", type: "Expr.Variable", label: "Expr.Variable", detail: "a", line: 10, children: [] },
            { id: "e6r", type: "Expr.Variable", label: "Expr.Variable", detail: "b", line: 10, children: [] },
          ],
        },
        {
          id: "s5t", type: "Stmt.Block", label: "Stmt.Block", detail: "thenBranch", line: 10,
          children: [
            {
              id: "s5t1", type: "Stmt.Print", label: "Stmt.Print", detail: "", line: 11,
              children: [{ id: "e7", type: "Expr.Literal", label: "Expr.Literal", detail: '"a is smaller"', line: 11, children: [] }],
            },
          ],
        },
      ],
    },
    {
      id: "s6", type: "Stmt.Var", label: "Stmt.Var", detail: 'name = "i"', line: 14,
      children: [{ id: "e8", type: "Expr.Literal", label: "Expr.Literal", detail: "0", line: 14, children: [] }],
    },
    {
      id: "s7", type: "Stmt.While", label: "Stmt.While", detail: "", line: 15,
      children: [
        {
          id: "e9", type: "Expr.Binary", label: "Expr.Binary", detail: "operator = <   (condition)", line: 15,
          children: [
            { id: "e9l", type: "Expr.Variable", label: "Expr.Variable", detail: "i", line: 15, children: [] },
            { id: "e9r", type: "Expr.Literal", label: "Expr.Literal", detail: "2", line: 15, children: [] },
          ],
        },
        {
          id: "s7b", type: "Stmt.Block", label: "Stmt.Block", detail: "body", line: 15,
          children: [
            {
              id: "s7b1", type: "Stmt.Print", label: "Stmt.Print", detail: "", line: 16,
              children: [{ id: "e10", type: "Expr.Variable", label: "Expr.Variable", detail: "i", line: 16, children: [] }],
            },
            {
              id: "s7b2", type: "Stmt.Expression", label: "Stmt.Expression", detail: "", line: 17,
              children: [
                {
                  id: "e11", type: "Expr.Assign", label: "Expr.Assign", detail: 'name = "i"', line: 17,
                  children: [
                    {
                      id: "e12", type: "Expr.Binary", label: "Expr.Binary", detail: "operator = +", line: 17,
                      children: [
                        { id: "e12l", type: "Expr.Variable", label: "Expr.Variable", detail: "i", line: 17, children: [] },
                        { id: "e12r", type: "Expr.Literal", label: "Expr.Literal", detail: "1", line: 17, children: [] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "s8",
      type: "Stmt.Block",
      label: "Stmt.Block",
      detail: "desugared for loop",
      line: 20,
      children: [
        {
          id: "s8_init",
          type: "Stmt.Var",
          label: "Stmt.Var",
          detail: 'name = "j"',
          line: 20,
          children: [
            { id: "e13", type: "Expr.Literal", label: "Expr.Literal", detail: "2", line: 20, children: [] }
          ]
        },
        {
          id: "s8_while",
          type: "Stmt.While",
          label: "Stmt.While",
          detail: "",
          line: 20,
          children: [
            {
              id: "e14",
              type: "Expr.Binary",
              label: "Expr.Binary",
              detail: "operator = >   (condition)",
              line: 20,
              children: [
                { id: "e14l", type: "Expr.Variable", label: "Expr.Variable", detail: "j", line: 20, children: [] },
                { id: "e14r", type: "Expr.Literal", label: "Expr.Literal", detail: "0", line: 20, children: [] }
              ]
            },
            {
              id: "s8_body",
              type: "Stmt.Block",
              label: "Stmt.Block",
              detail: "body + increment",
              line: 20,
              children: [
                {
                  id: "s8_print",
                  type: "Stmt.Print",
                  label: "Stmt.Print",
                  detail: "",
                  line: 21,
                  children: [
                    { id: "e15", type: "Expr.Variable", label: "Expr.Variable", detail: "j", line: 21, children: [] }
                  ]
                },
                {
                  id: "s8_inc",
                  type: "Stmt.Expression",
                  label: "Stmt.Expression",
                  detail: "",
                  line: 20,
                  children: [
                    {
                      id: "e16",
                      type: "Expr.Assign",
                      label: "Expr.Assign",
                      detail: 'name = "j"',
                      line: 20,
                      children: [
                        {
                          id: "e17",
                          type: "Expr.Binary",
                          label: "Expr.Binary",
                          detail: "operator = -",
                          line: 20,
                          children: [
                            { id: "e17l", type: "Expr.Variable", label: "Expr.Variable", detail: "j", line: 20, children: [] },
                            { id: "e17r", type: "Expr.Literal", label: "Expr.Literal", detail: "1", line: 20, children: [] }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. THE TRACE
// ---------------------------------------------------------------------------
// An array of runtime snapshots. `stepIndex` in the UI points directly to a 
// single snapshot in this list.
//
// Step Schema:
//   phase        "scan" | "parse" | "interpret"
//   line         1-based source line to highlight (null = no line)
//   tokenIndex   Index of token to highlight (scan phase only)
//   astNodeId    AST node ID to highlight (parse + interpret phases)
//   stack        Visitor call stack (outermost first) to make Java recursion visible
//   scopes       Environment chain (index 0 = global, last = innermost)
//   output       Cumulative stdout array printed up to this step
//   commentary   Explanatory text for Guided Mode
//   error        null, or { line, message } for Runtime Errors

/** Build one variable binding for a scope frame. */
const v = (name, value, type) => ({ name, value, type });

/** Build one trace step. Defaults keep the call sites short. */
const step = ({
  phase, line = null, tokenIndex = null, astNodeId = null,
  stack = [], scopes = [], output = [], commentary, error = null,
}) => ({ phase, line, tokenIndex, astNodeId, stack, scopes, output, commentary, error });

/** The global scope, at various points in the program. */
const G = (...vars) => ({ name: "global", vars });
/** A block scope created by visitBlockStmt. */
const B = (label, ...vars) => ({ name: label, vars });

// Shorthand for the global scope's contents at the two stable points it reaches.
const GLOBAL_AB = [v("a", "3", "number"), v("b", "4", "number")];
const GLOBAL_ABI = (iVal) => [...GLOBAL_AB, v("i", String(iVal), "number")];

// -- Phase 1: scanning -------------------------------------------------------
const SCAN_STEPS = [
  step({
    phase: "scan", line: 1, tokenIndex: null,
    commentary:
      "The scanner walks the source code one character at a time. It has no idea " +
      "what a program means — it only groups a list of characters into a list of TOKENS. " +
      "Think of it as turning a stream of letters into a stream of words.",
  }),
  step({
    phase: "scan", line: 1, tokenIndex: 0,
    commentary:
      "It reads 'v', 'a', 'r' and then peeks at the next character. Because it's " +
      "a space, the word ends. 'var' is in the keywords map, so this becomes a " +
      "VAR token, not an IDENTIFIER. This lookup is the trick to keywords.",
  }),
  step({
    phase: "scan", line: 1, tokenIndex: 1,
    commentary:
      "'a' is not in the keywords map, so it stays an IDENTIFIER. The scanner " +
      "does NOT check whether 'a' has been declared. That's a runtime concern.",
  }),
  step({
    phase: "scan", line: 1, tokenIndex: 3,
    commentary:
      "'3' becomes a NUMBER token with the literal value 3.0. Lox supports " +
      "integers and decimals, but under the hood, it stores ever number as a Java double. " +
      "We strip whole numbers of their trailing '.0' at runtime, so print 3; " +
      "outputs 3 instead of 3.0.",
  }),
  step({
    phase: "scan", line: 22, tokenIndex: TOKENS.length - 1,
    commentary:
      `Scanning finished: ${TOKENS.length} tokens, ending with EOF. We add the EOF token ` +
      "so that the parser knows when to stop instead of running off the end of the token " +
      "list. Open the Token Stream tab to see them all.",
  }),
];

// -- Phase 2: parsing --------------------------------------------------------
const PARSE_STEPS = [
  step({
    phase: "parse", line: 1, astNodeId: "program",
    commentary:
      "The parser turns our flat list of tokens into a nested tree (the AST). " +
      "It does this using Java methods that call each other recursively to figure out " +
      "which statements and expressions belong inside one another.",
  }),
  step({
    phase: "parse", line: 1, astNodeId: "s1",
    commentary:
      "The parser sees the VAR token and calls `varDeclaration()`, creating a " +
      "`Stmt.Var` node. Once this node is built, the structural shape of `var a = 3;` " +
      "is fixed permanently in the tree.",
  }),
  step({
    phase: "parse", line: 3, astNodeId: "e3",
    commentary:
      "When parsing `a + b`, `expression()` builds an `Expr.Binary` node holding '+' and " +
      "its two operands. Operator precedence is controlled naturally by the order in which " +
      "the parser methods call each other (e.g. multiplication methods run before " +
      "addition methods).",
  }),
  step({
    phase: "parse", line: 20, astNodeId: "s8",
    commentary:
      "Notice something cool: even though we wrote a `for` loop in the code, there is " +
      "NO `Stmt.For` node in the tree. The parser DESUGARS the `for` loop into a " +
      "`Stmt.Block` containing a `Stmt.While`. Essentially, we break down all for loops " +
      "into while loops during parsing.",
  }),
  step({
    phase: "parse", line: null, astNodeId: "program",
    commentary:
      "Parsing complete! The AST is now fully constructed. Head over to the AST tab " +
      "to explore the tree — from here on out, the interpreter's job " +
      "is simply walking through these tree nodes step by step.",
  }),
];

// -- Phase 3: interpreting ---------------------------------------------------

const INTERPRET_STEPS = [
  step({
    phase: "interpret", line: 1, astNodeId: "s1", stack: ["interpret"],
    scopes: [G()], output: [],
    commentary:
      "The interpreter walks the AST node by node to execute the program. " +
      "`interpret()` starts by looping over all top-level statements. " +
      "The global environment (which stores variable values) starts empty.",
  }),
  step({
    phase: "interpret", line: 1, astNodeId: "s1", stack: ["interpret", "visitVarStmt"],
    scopes: [G()], output: [],
    commentary:
      "To execute `var a = 3;`, `execute()` calls `stmt.accept(this)`. " +
      "This uses the Visitor pattern: the statement node routes execution to `visitVarStmt()` " +
      "without needing a giant `switch` statement.",
  }),
  step({
    phase: "interpret", line: 1, astNodeId: "e1",
    stack: ["interpret", "visitVarStmt", "visitLiteralExpr"],
    scopes: [G()], output: [],
    commentary:
      "Before storing `a`, `visitVarStmt()` must evaluate its value. " +
      "It calls `visitLiteralExpr()`, which simply returns the literal value `3.0`.",
  }),
  step({
    phase: "interpret", line: 1, astNodeId: "s1", stack: ["interpret", "visitVarStmt"],
    scopes: [G(v("a", "3", "number"))], output: [],
    commentary:
      "Back in `visitVarStmt()`, it saves `a = 3.0` into the global scope via " +
      "`environment.define(\"a\", 3.0)`. Look at the Scope Stack tab: 'a' is now defined!",
  }),
  step({
    phase: "interpret", line: 2, astNodeId: "s2", stack: ["interpret", "visitVarStmt"],
    scopes: [G(v("a", "3", "number"))], output: [],
    commentary: "Moving to line 2: `var b = 4;`. The interpreter begins evaluating statement 2.",
  }),
  step({
    phase: "interpret", line: 2, astNodeId: "s2", stack: ["interpret", "visitVarStmt"],
    scopes: [G(...GLOBAL_AB)], output: [],
    commentary:
      "`b` evaluates to `4.0` and is defined in the global scope. In Lox, re-declaring " +
      "a global variable overwrites any existing value without throwing an error.",
  }),
  step({
    phase: "interpret", line: 3, astNodeId: "s3", stack: ["interpret", "visitPrintStmt"],
    scopes: [G(...GLOBAL_AB)], output: [],
    commentary:
      "`print` is a language statement in Lox (not a library function call). " +
      "`visitPrintStmt()` takes over to evaluate the expression inside the print statement.",
  }),
  step({
    phase: "interpret", line: 3, astNodeId: "e3",
    stack: ["interpret", "visitPrintStmt", "visitBinaryExpr"],
    scopes: [G(...GLOBAL_AB)], output: [],
    commentary:
      "To print `a + b`, `visitBinaryExpr()` must evaluate the left expression first, " +
      "then the right. Lox strictly evaluates binary expressions left-to-right.",
  }),
  step({
    phase: "interpret", line: 3, astNodeId: "e3l",
    stack: ["interpret", "visitPrintStmt", "visitBinaryExpr", "visitVariableExpr"],
    scopes: [G(...GLOBAL_AB)], output: [],
    commentary:
      "Evaluating the left side (`a`): `visitVariableExpr()` calls " +
      "`environment.get(\"a\")`, returning `3.0`.",
  }),
  step({
    phase: "interpret", line: 3, astNodeId: "e3r",
    stack: ["interpret", "visitPrintStmt", "visitBinaryExpr", "visitVariableExpr"],
    scopes: [G(...GLOBAL_AB)], output: [],
    commentary:
      "Evaluating the right side (`b`): `environment.get(\"b\")` returns `4.0`.",
  }),
  step({
    phase: "interpret", line: 3, astNodeId: "e3",
    stack: ["interpret", "visitPrintStmt", "visitBinaryExpr"],
    scopes: [G(...GLOBAL_AB)], output: [],
    commentary:
      "With both sides evaluated (`3.0` and `4.0`), `visitBinaryExpr()` executes the `+` " +
      "operator. Because both operands are numbers, it performs addition, returning `7.0`.",
  }),
  step({
    phase: "interpret", line: 3, astNodeId: "s3", stack: ["interpret", "visitPrintStmt"],
    scopes: [G(...GLOBAL_AB)], output: ["7"],
    commentary:
      "`visitPrintStmt()` receives `7.0`, passes it to `stringify()` (which converts `7.0` " +
      "to `\"7\"`), and prints it to stdout.",
  }),

  // ---- block scope + shadowing ----
  step({
    phase: "interpret", line: 5, astNodeId: "s4", stack: ["interpret", "visitBlockStmt"],
    scopes: [G(...GLOBAL_AB), B("block @ line 5")], output: ["7"],
    commentary:
      "An opening brace `{` begins a new block scope. `visitBlockStmt()` creates a new " +
      "`Environment` whose `enclosing` field points to the global scope. " +
      "This parent-pointer chain is how nested scoping works in Lox.",
  }),
  step({
    phase: "interpret", line: 6, astNodeId: "s4a",
    stack: ["interpret", "visitBlockStmt", "visitVarStmt"],
    scopes: [G(...GLOBAL_AB), B("block @ line 5")], output: ["7"],
    commentary:
      "Inside the block, we evaluate `var a = \"inner\";`. " +
      "Notice that a global variable named `a` already exists.",
  }),
  step({
    phase: "interpret", line: 6, astNodeId: "s4a",
    stack: ["interpret", "visitBlockStmt", "visitVarStmt"],
    scopes: [G(...GLOBAL_AB), B("block @ line 5", v("a", '"inner"', "string"))],
    output: ["7"],
    commentary:
      "This is variable **shadowing**. `environment.define()` always writes to the innermost " +
      "(current) scope. The block gets its own `a`, leaving the global `a` untouched. " +
      "Check the Scope Stack tab to see both variables coexisting.",
  }),
  step({
    phase: "interpret", line: 7, astNodeId: "e5",
    stack: ["interpret", "visitBlockStmt", "visitPrintStmt", "visitVariableExpr"],
    scopes: [G(...GLOBAL_AB), B("block @ line 5", v("a", '"inner"', "string"))],
    output: ["7"],
    commentary:
      "When evaluating `print a;`, `environment.get(\"a\")` searches the innermost scope first. " +
      "It finds inner `a` (`\"inner\"`) immediately, so it never checks the global scope.",
  }),
  step({
    phase: "interpret", line: 7, astNodeId: "s4b",
    stack: ["interpret", "visitBlockStmt", "visitPrintStmt"],
    scopes: [G(...GLOBAL_AB), B("block @ line 5", v("a", '"inner"', "string"))],
    output: ["7", "inner"],
    commentary: "The statement completes and prints `inner` to stdout.",
  }),
  step({
    phase: "interpret", line: 8, astNodeId: "s4", stack: ["interpret"],
    scopes: [G(...GLOBAL_AB)], output: ["7", "inner"],
    commentary:
      "Reaching `}` finishes the block. In a `finally` block, `executeBlock()` restores the " +
      "previous environment. The inner scope is discarded, and global `a` (`3.0`) is active again.",
  }),

  // ---- if / else ----
  step({
    phase: "interpret", line: 10, astNodeId: "s5", stack: ["interpret", "visitIfStmt"],
    scopes: [G(...GLOBAL_AB)], output: ["7", "inner"],
    commentary:
      "`visitIfStmt()` begins. Control flow in a tree-walking interpreter is simple: " +
      "evaluate the condition first, then choose which child branch to execute.",
  }),
  step({
    phase: "interpret", line: 10, astNodeId: "e6l",
    stack: ["interpret", "visitIfStmt", "visitBinaryExpr", "visitVariableExpr"],
    scopes: [G(...GLOBAL_AB)], output: ["7", "inner"],
    commentary:
      "Evaluating the condition `a < b`. Left side (`a`) resolves to `3.0` " +
      "(retrieved from the global scope, since the previous block scope is gone).",
  }),
  step({
    phase: "interpret", line: 10, astNodeId: "e6r",
    stack: ["interpret", "visitIfStmt", "visitBinaryExpr", "visitVariableExpr"],
    scopes: [G(...GLOBAL_AB)], output: ["7", "inner"],
    commentary: "Right side (`b`) resolves to `4.0`.",
  }),
  step({
    phase: "interpret", line: 10, astNodeId: "e6",
    stack: ["interpret", "visitIfStmt", "visitBinaryExpr"],
    scopes: [G(...GLOBAL_AB)], output: ["7", "inner"],
    commentary:
      "The `<` comparison runs: `3.0 < 4.0` returns `true`.",
  }),
  step({
    phase: "interpret", line: 10, astNodeId: "s5t",
    stack: ["interpret", "visitIfStmt", "visitBlockStmt"],
    scopes: [G(...GLOBAL_AB), B("block @ line 10")], output: ["7", "inner"],
    commentary:
      "Because the condition evaluated to `true`, `visitIfStmt()` executes the `thenBranch`. " +
      "(In Lox, only `nil` and `false` count as false — everything else evaluates as true.) " +
      "Since the `then` branch is a block, a fresh block scope is created.",
  }),
  step({
    phase: "interpret", line: 11, astNodeId: "s5t1",
    stack: ["interpret", "visitIfStmt", "visitBlockStmt", "visitPrintStmt"],
    scopes: [G(...GLOBAL_AB), B("block @ line 10")], output: ["7", "inner", "a is smaller"],
    commentary:
      "Executes `print \"a is smaller\";` and outputs the string. " +
      "There is no `else` branch here, so `visitIfStmt()` simply finishes after this branch.",
  }),
  step({
    phase: "interpret", line: 12, astNodeId: "s5", stack: ["interpret"],
    scopes: [G(...GLOBAL_AB)], output: ["7", "inner", "a is smaller"],
    commentary: "The block ends, its scope is popped off the stack, and the `if` statement completes.",
  }),

// ---- the while loop ----
  step({
    phase: "interpret", line: 14, astNodeId: "s6", stack: ["interpret", "visitVarStmt"],
    scopes: [G(...GLOBAL_ABI(0))], output: ["7", "inner", "a is smaller"],
    commentary:
      "`var i = 0;` executes in the global scope. " +
      "Because `i` lives outside the loop body, its value survives across every iteration.",
  }),
];


// Generates trace steps for while loop iteration `i`.
const loopIteration = (i) => {
  const done = ["7", "inner", "a is smaller"];
  const printed = [...done, ...Array.from({ length: i }, (_, k) => String(k))];
  const g = (val) => [G(...GLOBAL_ABI(val))];
  const gb = (val) => [G(...GLOBAL_ABI(val)), B(`block @ line 15 (iteration ${i + 1})`)];

  return [
    step({
      phase: "interpret", line: 15, astNodeId: "s7", stack: ["interpret", "visitWhileStmt"],
      scopes: g(i), output: printed,
      commentary:
        i === 0
          ? "`visitWhileStmt()` begins. The interpreter relies on a standard Java `while` loop " +
            "to repeatedly evaluate the condition and execute the loop body."
          : `Iteration ${i + 1}: \`visitWhileStmt()\` loops back to re-check the condition.`,
    }),
    step({
      phase: "interpret", line: 15, astNodeId: "e9",
      stack: ["interpret", "visitWhileStmt", "visitBinaryExpr"],
      scopes: g(i), output: printed,
      commentary: `Evaluating condition \`i < 2\`: \`${i} < 2\` returns \`true\`. The loop body will execute.`,
    }),
    step({
      phase: "interpret", line: 15, astNodeId: "s7b",
      stack: ["interpret", "visitWhileStmt", "visitBlockStmt"],
      scopes: gb(i), output: printed,
      commentary:
        i === 0
          ? "The body is a block, so a fresh `Environment` scope is created for this iteration."
          : "A brand-new block scope is created for this iteration. The previous iteration's scope was already discarded.",
    }),
    step({
      phase: "interpret", line: 16, astNodeId: "e10",
      stack: ["interpret", "visitWhileStmt", "visitBlockStmt", "visitPrintStmt", "visitVariableExpr"],
      scopes: gb(i), output: printed,
      commentary:
        `Looking up \`i\`. It isn't in the inner block scope, so \`get()\` walks up the \`enclosing\` pointer ` +
        `to the global scope and finds \`i = ${i}\`.`,
    }),
    step({
      phase: "interpret", line: 16, astNodeId: "s7b1",
      stack: ["interpret", "visitWhileStmt", "visitBlockStmt", "visitPrintStmt"],
      scopes: gb(i), output: [...printed, String(i)],
      commentary: `Executes \`print i;\` and outputs \`${i}\`.`,
    }),
    step({
      phase: "interpret", line: 17, astNodeId: "e11",
      stack: ["interpret", "visitWhileStmt", "visitBlockStmt", "visitExpressionStmt", "visitAssignExpr"],
      scopes: gb(i), output: [...printed, String(i)],
      commentary:
        "Evaluating `i = i + 1;`. In Lox, assignment is an expression that produces a value, " +
        "so `visitAssignExpr()` handles updating the variable.",
    }),
    step({
      phase: "interpret", line: 17, astNodeId: "e12",
      stack: ["interpret", "visitWhileStmt", "visitBlockStmt", "visitExpressionStmt", "visitAssignExpr", "visitBinaryExpr"],
      scopes: gb(i), output: [...printed, String(i)],
      commentary: `Evaluating the right side first: \`i + 1\` becomes \`${i} + 1 = ${i + 1}\`.`,
    }),
    step({
      phase: "interpret", line: 17, astNodeId: "e11",
      stack: ["interpret", "visitWhileStmt", "visitBlockStmt", "visitExpressionStmt", "visitAssignExpr"],
      scopes: [G(...GLOBAL_ABI(i + 1)), B(`block @ line 15 (iteration ${i + 1})`)],
      output: [...printed, String(i)],
      commentary:
        "`environment.assign()` walks up the scope chain to update `i` where it was originally defined. " +
        `Global \`i\` is now updated to \`${i + 1}\`.`,
    }),
    step({
      phase: "interpret", line: 18, astNodeId: "s7", stack: ["interpret", "visitWhileStmt"],
      scopes: g(i + 1), output: [...printed, String(i)],
      commentary: "End of iteration body. Body scope is popped, and control jumps back to re-check the condition.",
    }),
  ];
};

const LOOP_EXIT_STEPS = [
  step({
    phase: "interpret", line: 15, astNodeId: "e9",
    stack: ["interpret", "visitWhileStmt", "visitBinaryExpr"],
    scopes: [G(...GLOBAL_ABI(2))], output: ["7", "inner", "a is smaller", "0", "1"],
    commentary:
      "Evaluating condition again: `i` is now `2`, so `2 < 2` returns `false`. " +
      "The `while` loop condition fails and the loop exits.",
  }),
  // ---- Desugared For Loop (Summarized) ----
  step({
    phase: "interpret", line: 20, astNodeId: "s8", 
    stack: ["interpret", "visitBlockStmt"],
    scopes: [G(...GLOBAL_ABI(2))], 
    output: ["7", "inner", "a is smaller", "0", "1", "0", "1"],
    commentary:
      "Next, we reach line 20's `for` loop. Because the parser desugared this into a `Stmt.Block` " +
      "containing a `Stmt.While`, the interpreter executes it using the exact same " +
      "`visitWhileStmt` mechanism we just stepped through!",
  }),
  // ---- Final Completion ----
  step({
    phase: "interpret", line: null, astNodeId: null, stack: [],
    scopes: [G(...GLOBAL_AB)], output: ["7", "inner", "a is smaller", "0", "1", "0", "1"],
    commentary:
      "Program execution complete! The visitor call stack is empty, and all temporary block scopes have been reclaimed.\n\n" +
      "Step back through the trace to observe how the call stack grew and shrank as the interpreter " +
      "traversed the AST!",
  }),
];

// ---------------------------------------------------------------------------
// 5. EXPORTS & BOUNDARIES
// ---------------------------------------------------------------------------

export const TRACE = [
  ...SCAN_STEPS,
  ...PARSE_STEPS,
  ...INTERPRET_STEPS,
  ...loopIteration(0),
  ...loopIteration(1),
  ...LOOP_EXIT_STEPS,
];

/** Where each phase begins — used by the phase-navigation buttons. */
export const PHASE_BOUNDARIES = {
  scan: 0,
  parse: SCAN_STEPS.length,
  interpret: SCAN_STEPS.length + PARSE_STEPS.length,
};
