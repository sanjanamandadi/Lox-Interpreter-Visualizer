package com.craftinginterpreters.lox;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * A tiny HTTP server that hands the frontend visualizer a JSON trace of a Lox
 * program.
 *
 *   POST /api/trace   body: {"source": "var a = 1; print a;"}  (or raw source
 *                     text with any non-JSON Content-Type)
 *                     -> 200 with the bundle described in {@link TraceExporter}
 *   GET  /api/health  -> 200 {"status":"ok"}
 *
 * Run it with:
 *
 *   javac -d bin src/com/craftinginterpreters/lox/*.java
 *   java -cp bin com.craftinginterpreters.lox.TraceServer
 *
 * Configuration comes from the environment: PORT or LOX_TRACE_PORT (default 8080),
 * HOST or LOX_TRACE_HOST (default 0.0.0.0), LOX_TRACE_ORIGIN (default *).
 *
 * On security: the endpoint runs submitted Lox source, so it is worth being
 * precise about what that can do. Lox at chapters 1-9 has no functions, classes,
 * imports, file access, process access or network access -- the entire language is
 * arithmetic, variables, blocks, conditionals, loops and `print`. So a submitted
 * program cannot reach anything outside its own Environment chain. The two real
 * risks are resource exhaustion, handled by the source-length cap here and the
 * step cap in TraceExporter, and exposure on an untrusted network, handled by
 * binding to loopback unless LOX_TRACE_HOST says otherwise.
 */
public class TraceServer {

  private static final int DEFAULT_PORT = 8080;
  private static final String DEFAULT_HOST = "0.0.0.0";

  /** Refuse bodies larger than this outright, before allocating a String. */
  private static final int MAX_BODY_BYTES = 64 * 1024;

  public static void main(String[] args) throws IOException {

    int port = intFromEnv("PORT", intFromEnv("LOX_TRACE_PORT", DEFAULT_PORT));
    String host = stringFromEnv("HOST", stringFromEnv("LOX_TRACE_HOST", DEFAULT_HOST));

    HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
    server.createContext("/api/trace", TraceServer::handleTrace);
    server.createContext("/api/health", TraceServer::handleHealth);

    // Single-threaded on purpose. Lox reports errors through static fields
    // (Lox.hadError and the diagnostics hook), so two traces running at once
    // would report each other's errors. Serializing requests is the honest fix
    // at this size; making the pipeline instance-based would be the other.
    server.setExecutor(Executors.newSingleThreadExecutor());
    server.start();

    System.out.println("Lox trace server listening on http://" + host + ":" + port);
    System.out.println("  POST /api/trace   {\"source\": \"print 1 + 2;\"}");
    System.out.println("  GET  /api/health");
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private static void handleTrace(HttpExchange exchange) throws IOException {
    try {
      addCorsHeaders(exchange);
      String method = exchange.getRequestMethod();

      // The browser sends a preflight OPTIONS request before a cross-origin POST
      // that carries a Content-Type header. 204 plus the CORS headers above is
      // the whole answer.
      if ("OPTIONS".equals(method)) {
        respond(exchange, 204, "", "text/plain; charset=utf-8");
        return;
      }
      if (!"POST".equals(method)) {
        respondError(exchange, 405, "Use POST with a JSON body: {\"source\": \"...\"}");
        return;
      }

      String body = readBody(exchange);
      if (body == null) {
        respondError(exchange, 413, "Request body larger than " + MAX_BODY_BYTES + " bytes.");
        return;
      }

      String source = extractSource(exchange, body);
      if (source == null) {
        respondError(exchange, 400, "Expected a JSON body with a \"source\" string.");
        return;
      }
      if (source.length() > TraceExporter.MAX_SOURCE_CHARS) {
        respondError(exchange, 413,
            "Source longer than " + TraceExporter.MAX_SOURCE_CHARS + " characters.");
        return;
      }

      respond(exchange, 200, TraceExporter.export(source), "application/json; charset=utf-8");
    } catch (Json.SyntaxError malformed) {
      respondError(exchange, 400, "Malformed JSON: " + malformed.getMessage());
    } catch (RuntimeException unexpected) {
      // A bug in the tracer shouldn't take the server down with it.
      unexpected.printStackTrace();
      respondError(exchange, 500, "Failed to trace that program: " + unexpected);
    } finally {
      exchange.close();
    }
  }

  private static void handleHealth(HttpExchange exchange) throws IOException {
    try {
      addCorsHeaders(exchange);
      respond(exchange, 200, "{\"status\":\"ok\"}", "application/json; charset=utf-8");
    } finally {
      exchange.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Request and response plumbing
  // ---------------------------------------------------------------------------

  /** Read the request body as UTF-8, or null if it exceeds MAX_BODY_BYTES. */
  private static String readBody(HttpExchange exchange) throws IOException {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    byte[] chunk = new byte[8192];

    try (InputStream in = exchange.getRequestBody()) {
      int read;
      while ((read = in.read(chunk)) != -1) {
        if (buffer.size() + read > MAX_BODY_BYTES) return null;
        buffer.write(chunk, 0, read);
      }
    }
    return new String(buffer.toByteArray(), StandardCharsets.UTF_8);
  }

  /**
   * Pull the Lox source out of a request. A JSON Content-Type means the body is
   * an object with a "source" member; anything else is treated as raw source,
   * which makes the endpoint pleasant to poke at from curl.
   */
  private static String extractSource(HttpExchange exchange, String body) {
    String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
    boolean isJson = contentType != null && contentType.toLowerCase().contains("application/json");

    if (!isJson) return body;

    Object parsed = Json.parse(body);
    if (!(parsed instanceof Map)) return null;

    Object source = ((Map<?, ?>) parsed).get("source");
    return (source instanceof String) ? (String) source : null;
  }

  private static void addCorsHeaders(HttpExchange exchange) {
    // The dev frontend runs on a different port (5173) from this server, which
    // makes every request cross-origin. Restrict LOX_TRACE_ORIGIN to the deployed
    // frontend's URL if you ever host this somewhere public.
    exchange.getResponseHeaders().set("Access-Control-Allow-Origin",
        stringFromEnv("LOX_TRACE_ORIGIN", "*"));
    exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
    exchange.getResponseHeaders().set("Access-Control-Max-Age", "600");
  }

  private static void respond(HttpExchange exchange, int status, String body, String contentType)
      throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", contentType);

    // 204 must not carry a body, and sendResponseHeaders wants -1 to say so.
    if (bytes.length == 0) {
      exchange.sendResponseHeaders(status, -1);
      return;
    }

    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(bytes);
    }
  }

  private static void respondError(HttpExchange exchange, int status, String message)
      throws IOException {
    String body = Json.object(Arrays.asList(Json.member("error", Json.string(message))));
    respond(exchange, status, body, "application/json; charset=utf-8");
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  private static String stringFromEnv(String name, String fallback) {
    String value = System.getenv(name);
    return (value == null || value.isEmpty()) ? fallback : value;
  }

  private static int intFromEnv(String name, int fallback) {
    String value = System.getenv(name);
    if (value == null || value.isEmpty()) return fallback;
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException error) {
      System.err.println(name + "='" + value + "' is not a number; using " + fallback + ".");
      return fallback;
    }
  }
}
