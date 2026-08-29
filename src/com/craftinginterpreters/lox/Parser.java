package com.craftinginterpreters.lox;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.craftinginterpreters.lox.TokenType.*;

public class Parser {
  private static class ParseError extends RuntimeException {}

  private final List<Token> tokens;
  private int current = 0;

  /**
   * Statements produced by forStatement(). A `for` loop leaves no node of its
   * own behind -- it is desugared into a Block wrapping a While -- so once parsing
   * finishes, this set is the only remaining record that the source said "for".
   * {@link TraceExporter} uses it to label those nodes in the visualizer.
   *
   * Identity-based, because two distinct loops can be structurally equal.
   */
  final Set<Stmt> desugaredForLoops =
      Collections.newSetFromMap(new IdentityHashMap<Stmt, Boolean>());

  /**
   * Source line for each node that doesn't carry a Token of its own.
   *
   * Most nodes can answer "what line am I on?" from a field -- Stmt.Var has its
   * name token, Expr.Binary has its operator. But Stmt.Block, Stmt.Print,
   * Stmt.If, Stmt.While, Stmt.Expression, Expr.Literal and Expr.Grouping hold no
   * token at all, and the parser is the last place in the pipeline that knows.
   * Recording it here keeps Expr.java and Stmt.java exactly as GenerateAst emits
   * them, at the cost of one side table.
   */
  final Map<Object, Integer> sourceLines = new IdentityHashMap<>();

  /** Remember `node`'s line as `token`'s line, and return the node for chaining. */
  private <T> T at(Token token, T node) {
    sourceLines.put(node, token.line);
    return node;
  }

  Parser(List<Token> tokens) {
    this.tokens = tokens;
  }

  List<Stmt> parse() {
    List<Stmt> statements = new ArrayList<>();
    while (!isAtEnd()) {
      statements.add(declaration());
    }

    return statements; 
  }

   private Expr expression() {
    return assignment();
  }

  private Stmt statement() {
    if (match(FOR)) return forStatement();
    if (match(IF)) return ifStatement();
    if (match(PRINT)) return printStatement();
    if (match(WHILE)) return whileStatement();
    if (match(LEFT_BRACE)) return at(previous(), new Stmt.Block(block()));

    return expressionStatement();
  }

  private Stmt forStatement() {
    // The 'for' keyword, already consumed by statement(). Every node this method
    // synthesizes is attributed to this line, since none of them appear in the
    // source as written.
    Token keyword = previous();
    consume(LEFT_PAREN, "Expect '(' after 'for'.");

    Stmt initializer;
    if (match(SEMICOLON)) {
      initializer = null;
    } else if (match(VAR)) {
      initializer = varDeclaration();
    } else {
      initializer = expressionStatement();
    }

    Expr condition = null;
    if (!check(SEMICOLON)) {
      condition = expression();
    }
    consume(SEMICOLON, "Expect ';' after loop condition.");

    Expr increment = null;
    if (!check(RIGHT_PAREN)) {
      increment = expression();
    }
    consume(RIGHT_PAREN, "Expect ')' after for clauses.");
    Stmt body = statement();

    if (increment != null) {
      body = at(keyword, new Stmt.Block(
          Arrays.asList(
              body,
              at(keyword, new Stmt.Expression(increment)))));
    }

    if (condition == null) condition = at(keyword, new Expr.Literal(true));
    body = at(keyword, new Stmt.While(condition, body));

    if (initializer != null) {
      body = at(keyword, new Stmt.Block(Arrays.asList(initializer, body)));
    }

    desugaredForLoops.add(body);
    return body;
  }


  private Stmt ifStatement() {
    Token keyword = previous();
    consume(LEFT_PAREN, "Expect '(' after 'if'.");
    Expr condition = expression();
    consume(RIGHT_PAREN, "Expect ')' after if condition.");

    Stmt thenBranch = statement();
    Stmt elseBranch = null;
    if (match(ELSE)) {
      elseBranch = statement();
    }

    return at(keyword, new Stmt.If(condition, thenBranch, elseBranch));
  }

  private Stmt declaration() {
    try {
      if (match(VAR)) return varDeclaration();

      return statement();
    } catch (ParseError error) {
      synchronize();
      return null;
    }
  }

  private Stmt printStatement() {
    Token keyword = previous();
    Expr value = expression();
    consume(SEMICOLON, "Expect ';' after value.");
    return at(keyword, new Stmt.Print(value));
  }

  private Stmt varDeclaration() {
    Token name = consume(IDENTIFIER, "Expect variable name.");

    Expr initializer = null;
    if (match(EQUAL)) {
      initializer = expression();
    }

    consume(SEMICOLON, "Expect ';' after variable declaration.");
    return new Stmt.Var(name, initializer);
  }

  private Stmt whileStatement() {
    Token keyword = previous();
    consume(LEFT_PAREN, "Expect '(' after 'while'.");
    Expr condition = expression();
    consume(RIGHT_PAREN, "Expect ')' after condition.");
    Stmt body = statement();

    return at(keyword, new Stmt.While(condition, body));
  }

  private Stmt expressionStatement() {
    Token start = peek();
    Expr expr = expression();
    consume(SEMICOLON, "Expect ';' after expression.");
    return at(start, new Stmt.Expression(expr));
  }

  private List<Stmt> block() {
    List<Stmt> statements = new ArrayList<>();

    while (!check(RIGHT_BRACE) && !isAtEnd()) {
      statements.add(declaration());
    }

    consume(RIGHT_BRACE, "Expect '}' after block.");
    return statements;
  }

  private Expr assignment() {
    Expr expr = or();

    if (match(EQUAL)) {
      Token equals = previous();
      Expr value = assignment();

      if (expr instanceof Expr.Variable) {
        Token name = ((Expr.Variable)expr).name;
        return new Expr.Assign(name, value);
      }

      error(equals, "Invalid assignment target."); 
    }

    return expr;
  }

  private Expr or() {
    Expr expr = and();

    while (match(OR)) {
      Token operator = previous();
      Expr right = and();
      expr = new Expr.Logical(expr, operator, right);
    }

    return expr;
  }

   private Expr and() {
    Expr expr = equality();

    while (match(AND)) {
      Token operator = previous();
      Expr right = equality();
      expr = new Expr.Logical(expr, operator, right);
    }

    return expr;
  }


  private Expr equality() {
    Expr expr = comparison();

    while (match(BANG_EQUAL, EQUAL_EQUAL)) {
      Token operator = previous();
      Expr right = comparison();
      expr = new Expr.Binary(expr, operator, right);
    }

    return expr;
  }

  private Expr comparison() {
    Expr expr = term();

    while (match(GREATER, GREATER_EQUAL, LESS, LESS_EQUAL)) {
      Token operator = previous();
      Expr right = term();
      expr = new Expr.Binary(expr, operator, right);
    }

    return expr;
  }

   private Expr term() {
    Expr expr = factor();

    while (match(MINUS, PLUS)) {
      Token operator = previous();
      Expr right = factor();
      expr = new Expr.Binary(expr, operator, right);
    }

    return expr;
  }

  private Expr factor() {
    Expr expr = unary();

    while (match(SLASH, STAR)) {
      Token operator = previous();
      Expr right = unary();
      expr = new Expr.Binary(expr, operator, right);
    }

    return expr;
  }

  private Expr unary() {
    if (match(BANG, MINUS)) {
      Token operator = previous();
      Expr right = unary();
      return new Expr.Unary(operator, right);
    }

    return primary();
  }

  private Expr primary() {
    if (match(FALSE)) return at(previous(), new Expr.Literal(false));
    if (match(TRUE)) return at(previous(), new Expr.Literal(true));
    if (match(NIL)) return at(previous(), new Expr.Literal(null));

    if (match(NUMBER, STRING)) {
      return at(previous(), new Expr.Literal(previous().literal));
    }

    if (match(IDENTIFIER)) {
      return new Expr.Variable(previous());
    }

    if (match(LEFT_PAREN)) {
      Token paren = previous();
      Expr expr = expression();
      consume(RIGHT_PAREN, "Expect ')' after expression.");
      return at(paren, new Expr.Grouping(expr));
    }

    throw error(peek(), "Expect expression.");
  }


  private boolean match(TokenType... types) {
    for (TokenType type : types) {
      if (check(type)) {
        advance();
        return true;
      }
    }

    return false;
  }

  private Token consume(TokenType type, String message) {
    if (check(type)) return advance();

    throw error(peek(), message);
  }

  private boolean check(TokenType type) {
    if (isAtEnd()) return false;
    return peek().type == type;
  }

  private Token advance() {
    if (!isAtEnd()) current++;
    return previous();
  }

  private boolean isAtEnd() {
    return peek().type == EOF;
  }

  private Token peek() {
    return tokens.get(current);
  }

  private Token previous() {
    return tokens.get(current - 1);
  }

  private ParseError error(Token token, String message) {
    Lox.error(token, message);
    return new ParseError();
  }

  private void synchronize() {
    advance();

    while (!isAtEnd()) {
      if (previous().type == SEMICOLON) return;

      switch (peek().type) {
        case VAR:
        case FOR:
        case IF:
        case WHILE:
        case PRINT:
          return;
      }

      advance();
    }
  }

}
