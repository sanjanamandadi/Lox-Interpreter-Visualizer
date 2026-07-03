package com.craftinginterpreters.lox;

import java.util.List;

class AstPrinter implements Expr.Visitor<String> {
  String print(Expr expr) {
    return expr.accept(this);
  }

  @Override
  public String visitBinaryExpr(Expr.Binary expr) {
    return parenthesize(expr.operator.lexeme,
                        expr.left, expr.right);
  }

  @Override
  public String visitGroupingExpr(Expr.Grouping expr) {
    return parenthesize("group", expr.expression);
  }

  @Override
  public String visitLiteralExpr(Expr.Literal expr) {
    if (expr.value == null) return "nil";
    return expr.value.toString();
  }

  @Override
  public String visitUnaryExpr(Expr.Unary expr) {
    return parenthesize(expr.operator.lexeme, expr.right);
  }

  private String parenthesize(String name, Expr... exprs) {
    StringBuilder builder = new StringBuilder();

    builder.append("(").append(name);
    for (Expr expr : exprs) {
      builder.append(" ");
      builder.append(expr.accept(this));
    }
    builder.append(")");

    return builder.toString();
  }

  public static void main(String[] args) {
      // 1. Scan the raw text into tokens
      Scanner scanner = new Scanner("4 + 6 / 3 - 1");
      List<Token> tokens = scanner.scanTokens();

      // 2. Parse the tokens into a dynamic AST tree
      Parser parser = new Parser(tokens);
      Expr expression = parser.parse();

      // 3. Print the resulting tree!
      if (expression != null)
        System.out.println(new AstPrinter().print(expression));
  }

}