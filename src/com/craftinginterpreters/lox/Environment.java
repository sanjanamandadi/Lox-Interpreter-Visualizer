package com.craftinginterpreters.lox;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public class Environment {
    final Environment enclosing;
    // LinkedHashMap rather than HashMap: a plain HashMap would list bindings in
    // an arbitrary order, so the visualizer's Scope Stack would shuffle names
    // around between runs. Insertion order is declaration order, which is what
    // someone reading the panel expects to see.
    private final Map<String, Object> values = new LinkedHashMap<>();

    Environment() {
        enclosing = null;
    }

    Environment(Environment enclosing) {
        this.enclosing = enclosing;
    }

    Object get(Token name) {
        if (values.containsKey(name.lexeme)) {
            return values.get(name.lexeme);
        }

        if (enclosing != null) return enclosing.get(name);

        throw new RuntimeError(name,
            "Undefined variable '" + name.lexeme + "'.");
    }

    void assign(Token name, Object value) {
    if (values.containsKey(name.lexeme)) {
      values.put(name.lexeme, value);
      return;
    }

    if (enclosing != null) {
      enclosing.assign(name, value);
      return;
    }

    throw new RuntimeError(name,
        "Undefined variable '" + name.lexeme + "'.");
  }

    void define(String name, Object value) {
        values.put(name, value);
    }

    /**
     * Read-only view of the bindings declared in THIS scope, ignoring anything
     * reachable through `enclosing`. Used by {@link TraceExporter} to snapshot
     * the environment chain one frame at a time.
     */
    Map<String, Object> bindings() {
        return Collections.unmodifiableMap(values);
    }
}
