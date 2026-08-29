package com.craftinginterpreters.lox;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A minimal JSON reader and writer.
 *
 * The interpreter deliberately has no third-party dependencies, and the two
 * shapes we actually exchange with the visualizer are small: a request that is
 * one object with a "source" string, and a response we build ourselves. So this
 * is a complete-but-tiny implementation rather than a Jackson dependency.
 *
 * Writing is a handful of escape/format helpers. Reading is a recursive-descent
 * parser -- the same technique as {@link Parser}, one level simpler, because JSON
 * needs no precedence rules.
 */
final class Json {
  private Json() {}

  // ---------------------------------------------------------------------------
  // Writing
  // ---------------------------------------------------------------------------

  /** Render a Java String as a quoted, escaped JSON string. */
  static String string(String value) {
    if (value == null) return "null";

    StringBuilder out = new StringBuilder(value.length() + 2);
    out.append('"');
    for (int i = 0; i < value.length(); i++) {
      char c = value.charAt(i);
      switch (c) {
        case '"':  out.append("\\\""); break;
        case '\\': out.append("\\\\"); break;
        case '\n': out.append("\\n"); break;
        case '\r': out.append("\\r"); break;
        case '\t': out.append("\\t"); break;
        case '\b': out.append("\\b"); break;
        case '\f': out.append("\\f"); break;
        default:
          // JSON forbids raw control characters; everything else can go through
          // as-is because we always send the response as UTF-8.
          if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
          else out.append(c);
      }
    }
    out.append('"');
    return out.toString();
  }

  /** Render a double as a JSON number. JSON has no NaN or Infinity. */
  static String number(double value) {
    if (Double.isNaN(value) || Double.isInfinite(value)) return "null";
    // Double.toString keeps the ".0" on whole numbers, which is exactly what we
    // want the visualizer to show: every Lox number is a Java double.
    return Double.toString(value);
  }

  /** Render a Lox literal (null, Boolean, Double or String) as a JSON value. */
  static String literal(Object value) {
    if (value == null) return "null";
    if (value instanceof Boolean) return value.toString();
    if (value instanceof Double) return number((Double) value);
    return string(value.toString());
  }

  /** Join already-serialized JSON values into an array. */
  static String array(List<String> jsonValues) {
    return "[" + String.join(",", jsonValues) + "]";
  }

  /** Wrap a key and an already-serialized JSON value into one object member. */
  static String member(String key, String jsonValue) {
    return string(key) + ":" + jsonValue;
  }

  /** Join already-serialized members into an object. */
  static String object(List<String> members) {
    return "{" + String.join(",", members) + "}";
  }

  // ---------------------------------------------------------------------------
  // Reading
  // ---------------------------------------------------------------------------

  /** Thrown for malformed input, so callers can answer 400 rather than 500. */
  static class SyntaxError extends RuntimeException {
    SyntaxError(String message) {
      super(message);
    }
  }

  /**
   * Parse JSON text into Java values: Map for objects, List for arrays, String,
   * Double, Boolean, or null.
   */
  static Object parse(String text) {
    Reader reader = new Reader(text);
    Object value = reader.value();
    reader.skipWhitespace();
    if (!reader.isAtEnd()) {
      throw new SyntaxError("Unexpected trailing content in JSON.");
    }
    return value;
  }

  private static final class Reader {
    private final String text;
    private int current = 0;

    Reader(String text) {
      this.text = text;
    }

    Object value() {
      skipWhitespace();
      if (isAtEnd()) throw new SyntaxError("Unexpected end of JSON input.");

      char c = peek();
      switch (c) {
        case '{': return object();
        case '[': return array();
        case '"': return string();
        case 't': return keyword("true", Boolean.TRUE);
        case 'f': return keyword("false", Boolean.FALSE);
        case 'n': return keyword("null", null);
        default:
          if (c == '-' || (c >= '0' && c <= '9')) return number();
          throw new SyntaxError("Unexpected character '" + c + "' in JSON.");
      }
    }

    private Map<String, Object> object() {
      expect('{');
      Map<String, Object> members = new LinkedHashMap<>();
      skipWhitespace();
      if (match('}')) return members;

      do {
        skipWhitespace();
        String key = string();
        skipWhitespace();
        expect(':');
        members.put(key, value());
        skipWhitespace();
      } while (match(','));

      expect('}');
      return members;
    }

    private List<Object> array() {
      expect('[');
      List<Object> items = new ArrayList<>();
      skipWhitespace();
      if (match(']')) return items;

      do {
        items.add(value());
        skipWhitespace();
      } while (match(','));

      expect(']');
      return items;
    }

    private String string() {
      expect('"');
      StringBuilder out = new StringBuilder();
      while (!isAtEnd() && peek() != '"') {
        char c = advance();
        if (c != '\\') {
          out.append(c);
          continue;
        }

        if (isAtEnd()) throw new SyntaxError("Unterminated escape in JSON string.");
        char escape = advance();
        switch (escape) {
          case '"':  out.append('"'); break;
          case '\\': out.append('\\'); break;
          case '/':  out.append('/'); break;
          case 'b':  out.append('\b'); break;
          case 'f':  out.append('\f'); break;
          case 'n':  out.append('\n'); break;
          case 'r':  out.append('\r'); break;
          case 't':  out.append('\t'); break;
          case 'u':
            if (current + 4 > text.length()) {
              throw new SyntaxError("Truncated \\u escape in JSON string.");
            }
            String hex = text.substring(current, current + 4);
            current += 4;
            try {
              out.append((char) Integer.parseInt(hex, 16));
            } catch (NumberFormatException error) {
              throw new SyntaxError("Invalid \\u escape '" + hex + "' in JSON string.");
            }
            break;
          default:
            throw new SyntaxError("Invalid escape '\\" + escape + "' in JSON string.");
        }
      }

      expect('"');
      return out.toString();
    }

    private Double number() {
      int start = current;
      if (match('-')) { /* optional sign */ }
      while (!isAtEnd() && isNumberChar(peek())) advance();

      try {
        return Double.valueOf(text.substring(start, current));
      } catch (NumberFormatException error) {
        throw new SyntaxError("Invalid number in JSON.");
      }
    }

    private Object keyword(String word, Object result) {
      if (!text.startsWith(word, current)) {
        throw new SyntaxError("Expected '" + word + "' in JSON.");
      }
      current += word.length();
      return result;
    }

    private boolean isNumberChar(char c) {
      return (c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E'
          || c == '+' || c == '-';
    }

    void skipWhitespace() {
      while (!isAtEnd()) {
        char c = peek();
        if (c == ' ' || c == '\t' || c == '\n' || c == '\r') current++;
        else break;
      }
    }

    private void expect(char expected) {
      skipWhitespace();
      if (isAtEnd() || peek() != expected) {
        throw new SyntaxError("Expected '" + expected + "' in JSON.");
      }
      current++;
    }

    private boolean match(char expected) {
      skipWhitespace();
      if (isAtEnd() || peek() != expected) return false;
      current++;
      return true;
    }

    boolean isAtEnd() {
      return current >= text.length();
    }

    private char peek() {
      return text.charAt(current);
    }

    private char advance() {
      return text.charAt(current++);
    }
  }
}
