import { ArrowUp, Globe, Layers } from "lucide-react";

/** Colour a binding's value by its Lox runtime type. */
const VALUE_COLOR = {
  string: "text-str",
  number: "text-num",
  boolean: "text-parse",
  nil: "text-dim",
};

/**
 * ScopeStack (Panel 3, Tab 2) — the Environment chain.
 *
 * Props:
 *   scopes  [{ name, vars: [{ name, value, type }] }], index 0 = global
 *   phase   "scan" | "parse" | "interpret"
 *
 * Rendered innermost-FIRST, which is the order Environment.get() searches: check
 * my own map, and only on a miss follow `enclosing` outward. Drawing it in lookup
 * order means the panel reads top-to-bottom the way the Java method executes.
 *
 * The two ideas this panel exists to make obvious:
 *   1. Shadowing — two frames can hold the same name; the inner one wins.
 *   2. Lifetime — a frame vanishes the instant its block ends.
 */
export default function ScopeStack({ scopes = [], phase }) {
  if (phase !== "interpret") {
    return (
      <div className="p-4 text-[11px] leading-relaxed text-dim">
        No environments exist yet.
        <div className="mt-2">
          Scanning and parsing never touch variable values — a{" "}
          <span className="text-bright">Stmt.Var</span> node knows a variable's
          NAME but has no idea what it holds. Storage only appears at runtime.
        </div>
      </div>
    );
  }

  // Reverse a COPY. Array.reverse() mutates in place, and mutating a prop would
  // corrupt the shared trace data, making steps behave differently the second
  // time you visit them.
  const innermostFirst = [...scopes].reverse();

  // Collect names that appear in more than one frame, so we can flag shadowing.
  const nameCounts = {};
  for (const scope of scopes) {
    for (const variable of scope.vars) {
      nameCounts[variable.name] = (nameCounts[variable.name] ?? 0) + 1;
    }
  }

  return (
    <div className="p-2">
      <div className="mb-2 px-1 text-[10px] leading-relaxed text-dim">
        Innermost scope first — the order{" "}
        <span className="text-bright">Environment.get()</span> searches.
      </div>

      <div className="space-y-1.5">
        {innermostFirst.map((scope, index) => {
          const isInnermost = index === 0;
          const isGlobal = scope.name === "global";

          return (
            <div key={`${scope.name}-${index}`}>
              <div
                className={`rounded border ${
                  isInnermost
                    ? "border-runtime/50 bg-runtime/10"
                    : "border-edge bg-panel-hi/30"
                }`}
              >
                <div className="flex items-center gap-1.5 border-b border-edge/60 px-2 py-1">
                  {isGlobal ? (
                    <Globe size={11} className="text-dim" aria-hidden="true" />
                  ) : (
                    <Layers size={11} className="text-runtime" aria-hidden="true" />
                  )}
                  <span
                    className={`text-[11px] ${isInnermost ? "text-runtime" : "text-bright/70"}`}
                  >
                    {scope.name}
                  </span>
                  {isInnermost && !isGlobal && (
                    <span className="text-[9px] text-runtime/70">← current</span>
                  )}
                  <span className="ml-auto text-[9px] text-dim">
                    {scope.vars.length === 0
                      ? "empty"
                      : `${scope.vars.length} binding${scope.vars.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                {scope.vars.length === 0 ? (
                  <div className="px-2 py-1 text-[10px] text-dim/60 italic">
                    HashMap is empty
                  </div>
                ) : (
                  <div className="divide-y divide-edge/40">
                    {scope.vars.map((variable) => {
                      // Shadowed only if the name also exists further out AND
                      // we're not in the innermost frame that declares it.
                      const isShadowed = nameCounts[variable.name] > 1 && !isInnermost;
                      return (
                        <div
                          key={variable.name}
                          className={`flex items-center gap-2 px-2 py-1 text-[11px] ${
                            isShadowed ? "opacity-45" : ""
                          }`}
                        >
                          <span className="text-bright">{variable.name}</span>
                          <span className="text-dim">=</span>
                          <span className={VALUE_COLOR[variable.type] ?? "text-num"}>
                            {variable.value}
                          </span>
                          {isShadowed && (
                            <span
                              className="ml-auto text-[9px] text-bad/80"
                              title="A nearer scope declares this same name, so get() finds that one first"
                            >
                              shadowed
                            </span>
                          )}
                          {nameCounts[variable.name] > 1 && isInnermost && (
                            <span
                              className="ml-auto text-[9px] text-good/80"
                              title="This is the binding get() will find"
                            >
                              shadows outer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* The `enclosing` pointer, drawn between frames. This arrow is
                  literally the `final Environment enclosing` field. */}
              {index < innermostFirst.length - 1 && (
                <div className="flex items-center gap-1 py-0.5 pl-3 text-[9px] text-dim/60">
                  <ArrowUp size={10} aria-hidden="true" />
                  enclosing
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
