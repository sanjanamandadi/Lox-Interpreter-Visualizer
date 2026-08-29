package com.craftinginterpreters.lox;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

public class Lox {

  /**
   * Where diagnostics go. Errors are reported from all over the scanner, parser
   * and interpreter through the static helpers below, so this hook is how
   * {@link TraceServer} captures them for one request instead of losing them to
   * the server's stderr. Null means "print to stderr", i.e. normal CLI use.
   */
  interface DiagnosticSink {
    void report(int line, String message);
  }

  private static final Interpreter interpreter = new Interpreter();
  static DiagnosticSink diagnostics = null;
  static boolean hadError = false;
  static boolean hadRuntimeError = false;

  /** Clear the error flags. The CLI does this per REPL line; the server per request. */
  static void resetErrors() {
    hadError = false;
    hadRuntimeError = false;
  }
  public static void main(String[] args) throws IOException {
    if (args.length > 1) {
      System.out.println("Usage: jlox [script]");
      System.exit(64); 
    } else if (args.length == 1) {
      runFile(args[0]);
    } else {
      runPrompt();
    }
  }

   private static void runFile(String path) throws IOException {
    byte[] bytes = Files.readAllBytes(Paths.get(path));
    run(new String(bytes, Charset.defaultCharset()));

    // Indicate an error in the exit code.
    if (hadError) System.exit(65);
    if (hadRuntimeError) System.exit(70);
  }

   private static void runPrompt() throws IOException {
    InputStreamReader input = new InputStreamReader(System.in);
    BufferedReader reader = new BufferedReader(input);

    for (;;) { 
      System.out.print("> ");
      String line = reader.readLine();
      if (line == null) break;
      run(line);
      hadError = false;
    }
  }

  private static void run(String source) {
    Scanner scanner = new Scanner(source);
    List<Token> tokens = scanner.scanTokens();

    Parser parser = new Parser(tokens);
    List<Stmt> statements = parser.parse();

    // Stop if there was a syntax error.
    if (hadError) return;

    interpreter.interpret(statements);
  }

  static void error(int line, String message) {
    report(line, "", message);
  }

  private static void report(int line, String where,
                             String message) {
    String text = "Error" + where + ": " + message;
    if (diagnostics != null) {
      diagnostics.report(line, text);
    } else {
      System.err.println("[line " + line + "] " + text);
    }
    hadError = true;
  }

  static void error(Token token, String message) {
    if (token.type == TokenType.EOF) {
      report(token.line, " at end", message);
    } else {
      report(token.line, " at '" + token.lexeme + "'", message);
    }
  }

  static void runtimeError(RuntimeError error) {
    if (diagnostics != null) {
      diagnostics.report(error.token.line, error.getMessage());
    } else {
      System.err.println(error.getMessage() +
          "\n[line " + error.token.line + "]");
    }
    hadRuntimeError = true;
  }

}
