package com.craftinginterpreters.lox;

import java.util.List;

public class Interpreter implements Expr.Visitor<Object>, Stmt.Visitor<Void> {

    /**
     * Optional observer of the tree walk, implemented by {@link TraceExporter}
     * to record a step-by-step trace for the visualizer. It is null for normal
     * runs, and the interpreter's behaviour is identical either way -- a probe
     * only ever reads state, it never influences evaluation.
     */
    interface Probe {
      /** A visitor method is about to run for `node` (null for interpret()). */
      void enter(String visitor, Object node);

      /** That visitor method returned. `result` is null for statements. */
      void exit(String visitor, Object node, Object result);

      /** visitPrintStmt wrote a line to stdout. */
      void printed(String text);

      /** Evaluation was abandoned because of a runtime error. */
      void failed(RuntimeError error);
    }

    private Environment environment = new Environment();
    private Probe probe;

    /** Attach a probe (or pass null to detach) before calling interpret(). */
    void setProbe(Probe probe) {
      this.probe = probe;
    }

    /** The innermost environment right now; walk `enclosing` for the full chain. */
    Environment currentEnvironment() {
      return environment;
    }

    /**
     * The visitor method that handles a node: Expr.Binary -> "visitBinaryExpr",
     * Stmt.Var -> "visitVarStmt". Deriving the name from the node's class means
     * the visit methods below need no instrumentation of their own -- the two
     * dispatch points, evaluate() and execute(), cover all of them.
     */
    private static String visitorName(Object node) {
      String suffix = (node instanceof Expr) ? "Expr" : "Stmt";
      return "visit" + node.getClass().getSimpleName() + suffix;
    }

    void interpret(List<Stmt> statements) {
    try {
      if (probe != null) probe.enter("interpret", null);

      for (Stmt statement : statements) {
        execute(statement);
      }

      if (probe != null) probe.exit("interpret", null, null);
    } catch (RuntimeError error) {
      if (probe != null) probe.failed(error);
      Lox.runtimeError(error);
    }
  }



     @Override
     public Object visitLiteralExpr(Expr.Literal expr) {
        return expr.value;
     }

     @Override
    public Object visitLogicalExpr(Expr.Logical expr) {
      Object left = evaluate(expr.left);

      if (expr.operator.type == TokenType.OR) {
        if (isTruthy(left)) return left;
      } else {
        if (!isTruthy(left)) return left;
      }

      return evaluate(expr.right);
    }


     @Override
     public Object visitGroupingExpr(Expr.Grouping expr) {
        return evaluate(expr.expression);
     }

     // The two dispatch points. When a probe is attached, every recursive
     // descent into the tree is bracketed by enter/exit here -- which is exactly
     // what the visualizer draws as the visitor call stack.
     //
     // Note the deliberate absence of try/finally: if accept() throws a
     // RuntimeError, we do NOT report an exit, because the frame did not return
     // a value. The probe unwinds its own stack when failed() arrives.
     private Object evaluate(Expr expr) {
        if (probe == null) return expr.accept(this);

        String visitor = visitorName(expr);
        probe.enter(visitor, expr);
        Object result = expr.accept(this);
        probe.exit(visitor, expr, result);
        return result;
     }

     private void execute(Stmt stmt) {
        if (probe == null) {
          stmt.accept(this);
          return;
        }

        String visitor = visitorName(stmt);
        probe.enter(visitor, stmt);
        stmt.accept(this);
        probe.exit(visitor, stmt, null);
     }

     void executeBlock(List<Stmt> statements,
                    Environment environment) {
      Environment previous = this.environment;
      try {
        this.environment = environment;

        for (Stmt statement : statements) {
          execute(statement);
        }
      } finally {
        this.environment = previous;
      }
    }

     @Override
    public Void visitBlockStmt(Stmt.Block stmt) {
      executeBlock(stmt.statements, new Environment(environment));
      return null;
    }

      @Override
    public Void visitExpressionStmt(Stmt.Expression stmt) {
      evaluate(stmt.expression);
      return null;
    }

    @Override
    public Void visitIfStmt(Stmt.If stmt) {
      if (isTruthy(evaluate(stmt.condition))) {
        execute(stmt.thenBranch);
      } else if (stmt.elseBranch != null) {
        execute(stmt.elseBranch);
      }
      return null;
    }

     @Override
    public Void visitPrintStmt(Stmt.Print stmt) {
      Object value = evaluate(stmt.expression);
      String text = stringify(value);
      System.out.println(text);
      if (probe != null) probe.printed(text);
      return null;
    }

    @Override
    public Void visitVarStmt(Stmt.Var stmt) {
      Object value = null;
      if (stmt.initializer != null) {
        value = evaluate(stmt.initializer);
      }

      environment.define(stmt.name.lexeme, value);
      return null;
    }

     @Override
    public Void visitWhileStmt(Stmt.While stmt) {
      while (isTruthy(evaluate(stmt.condition))) {
        execute(stmt.body);
      }
      return null;
    }


    @Override
    public Object visitAssignExpr(Expr.Assign expr) {
      Object value = evaluate(expr.value);
      environment.assign(expr.name, value);
      return value;
    }

      @Override
    public Object visitUnaryExpr(Expr.Unary expr) {
        Object right = evaluate(expr.right);

        switch (expr.operator.type) {
            case BANG:
                return !isTruthy(right);
            case MINUS:
                checkNumberOperand(expr.operator, right);
                return -(double)right;
        }

        // Unreachable.
        return null;
    }

    @Override
    public Object visitVariableExpr(Expr.Variable expr) {
      return environment.get(expr.name);
    }

    private void checkNumberOperand(Token operator, Object operand) {
      if (operand instanceof Double) return;
      throw new RuntimeError(operator, "Operand must be a number.");
    }

    private void checkNumberOperands(Token operator,
                                   Object left, Object right) {
      if (left instanceof Double && right instanceof Double) 
        return;
      throw new RuntimeError(operator, "Operands must be numbers.");
    }

    @Override
  public Object visitBinaryExpr(Expr.Binary expr) {
    Object left = evaluate(expr.left);
    Object right = evaluate(expr.right); 

    switch (expr.operator.type) {
      case BANG_EQUAL: return !isEqual(left, right);
      case EQUAL_EQUAL: return isEqual(left, right);
      case GREATER:
        checkNumberOperands(expr.operator, left, right);
        return (double)left > (double)right;
      case GREATER_EQUAL:
        checkNumberOperands(expr.operator, left, right);
        return (double)left >= (double)right;
      case LESS:
        checkNumberOperands(expr.operator, left, right);
        return (double)left < (double)right;
      case LESS_EQUAL:
        checkNumberOperands(expr.operator, left, right);
        return (double)left <= (double)right;  
      case MINUS:
        checkNumberOperands(expr.operator, left, right);
        return (double)left - (double)right;
      case PLUS:
        if (left instanceof Double && right instanceof Double) {
          return (double)left + (double)right;
        } 

        if (left instanceof String && right instanceof String) {
          return (String)left + (String)right;
        }

        throw new RuntimeError(expr.operator,
            "Operands must be two numbers or two strings."); 
      case SLASH:
        checkNumberOperands(expr.operator, left, right);
        return (double)left / (double)right;
      case STAR:
        checkNumberOperands(expr.operator, left, right);
        return (double)left * (double)right;

    }

    // Unreachable.
    return null;
  }

    private boolean isTruthy(Object object) {
        if (object == null) return false;
        if (object instanceof Boolean) return (boolean)object;
        return true;
  }

  private boolean isEqual(Object a, Object b) {
    if (a == null && b == null) return true;
    if (a == null) return false;

    return a.equals(b);
  }

  /**
   * How a Lox value is shown to the user. Package-private rather than private so
   * TraceExporter can format values the same way instead of reimplementing the
   * trailing-".0" rule and getting it subtly different.
   */
  String stringify(Object object) {
    if (object == null) return "nil";

    if (object instanceof Double) {
      String text = object.toString();
      if (text.endsWith(".0")) {
        text = text.substring(0, text.length() - 2);
      }
      return text;
    }

    return object.toString();
  }

  
}
