import { CornerDownRight } from "lucide-react";

/**
 * VisitorStack (Panel 3, Tab 1) — which visitor methods are on the JVM's call
 * stack right now.
 *
 * Reading Interpreter.java, the recursion is invisible: `evaluate(expr.left)`
 * looks like an ordinary method call. But that one line pushes a frame, and the
 * depth of the stack at any moment IS the depth of the AST node being evaluated.
 * Drawing it makes that correspondence visible.
 */

/** One-line reminder of what each visitor actually does. */
const EXPLANATIONS = {
  interpret: "loops over statements, calling execute()",
  visitVarStmt: "evaluate initializer, then environment.define()",
  visitPrintStmt: "evaluate, stringify, System.out.println",
  visitExpressionStmt: "evaluate and discard the result",
  visitBlockStmt: "new Environment(enclosing), restore in finally",
  visitIfStmt: "evaluate condition, execute one branch",
  visitWhileStmt: "Java while loop around evaluate + execute",
  visitBinaryExpr: "evaluate left, evaluate right, apply operator",
  visitUnaryExpr: "evaluate operand, then negate",
  visitLiteralExpr: "return expr.value — recursion bottoms out here",
  visitVariableExpr: "environment.get(name), walking outward",
  visitAssignExpr: "evaluate value, then environment.assign()",
  visitLogicalExpr: "short-circuits: may never evaluate the right side",
  visitGroupingExpr: "unwrap the parentheses and evaluate inside",
};

/**
 * Props:
 *   stack  array of visitor method names, outermost frame first
 *   phase  "scan" | "parse" | "interpret"
 */
export default function VisitorStack({ stack = [], phase }) {
  if (phase !== "interpret") {
    return (
      <div className="p-4 text-[11px] leading-relaxed text-dim">
        The visitor stack is empty until interpretation begins.
        <div className="mt-2">
          Scanning and parsing don't use the Visitor pattern at all — they build
          data structures. The visitor only appears once we start{" "}
          <span className="text-bright">consuming</span> the tree.
        </div>
      </div>
    );
  }

  if (stack.length === 0) {
    return (
      <div className="p-4 text-[11px] text-dim">
        Stack empty — <span className="text-good">program complete</span>. Every
        frame that was pushed has returned.
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="mb-2 px-1 text-[10px] leading-relaxed text-dim">
        The JVM call stack inside{" "}
        <span className="text-runtime">Interpreter.java</span>, outermost first.
        Depth <span className="text-bright">{stack.length}</span>.
      </div>

      <div className="space-y-0.5">
        {stack.map((method, index) => {
          // The last frame is the one currently executing; everything above it
          // is paused, waiting for a return value.
          const isCurrent = index === stack.length - 1;
          return (
            <div
              key={`${method}-${index}`}
              style={{ marginLeft: `${index * 10}px` }}
              className={`flex items-start gap-1.5 rounded border px-2 py-1 ${
                isCurrent
                  ? "animate-flash border-runtime/50 bg-runtime/15"
                  : "border-edge/60 bg-panel-hi/40"
              }`}
            >
              {index > 0 && (
                <CornerDownRight
                  size={11}
                  className="mt-0.5 shrink-0 text-dim/50"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <div
                  className={`text-[11px] ${isCurrent ? "font-semibold text-runtime" : "text-bright/70"}`}
                >
                  {method}()
                  {isCurrent && (
                    <span className="ml-1.5 text-[9px] font-normal text-runtime/70">
                      ← executing
                    </span>
                  )}
                </div>
                <div className="text-[10px] leading-snug text-dim">
                  {EXPLANATIONS[method] ?? ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-edge px-1 pt-2 text-[10px] leading-relaxed text-dim">
        Frames above the highlighted one are <span className="text-bright">paused</span>,
        each waiting for the value the frame below it will return.
      </div>
    </div>
  );
}
