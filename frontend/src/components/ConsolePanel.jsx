import { Info, Terminal, TriangleAlert } from "lucide-react";

/**
 * ConsolePanel (bottom) — stdout, system notices, and runtime errors.
 *
 * Props:
 *   output  cumulative stdout lines as of the current step
 *   error   null, or { line, message } for a runtime error
 *   notice  null, or an app-level message (backend unreachable, mode hints)
 *
 * `output` is cumulative, so this panel needs no memory of its own. Step backward
 * and a line un-prints, because we simply render a shorter array.
 */
export default function ConsolePanel({ output = [], error = null, notice = null }) {
  const hasError = Boolean(error && error.message);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-edge bg-panel">
      <header className="flex shrink-0 items-center gap-2 border-b border-edge px-3 py-1.5">
        <Terminal size={13} className="text-good" aria-hidden="true" />
        <h2 className="text-[11px] font-semibold tracking-wider text-dim uppercase">
          Console
        </h2>
        <span className="text-[10px] text-dim/60">System.out</span>

        {hasError && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-bad">
            <TriangleAlert size={11} aria-hidden="true" /> runtime error
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-2 text-xs" aria-live="polite">
        {notice && (
          <div className="mb-2 flex items-start gap-2 rounded border border-parse/40 bg-parse/10 px-2 py-1.5 text-[11px] leading-relaxed text-parse">
            <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {output.length === 0 && !hasError && !notice && (
          <div className="px-1 text-[11px] text-dim/60 italic">
            No output yet — nothing has reached visitPrintStmt.
          </div>
        )}

        {output.map((line, index) => (
          <div key={index} className="flex gap-2 px-1 leading-relaxed">
            <span className="select-none text-dim/40" aria-hidden="true">
              ›
            </span>
            <span className="text-good">{line}</span>
          </div>
        ))}

        {hasError && (
          <div className="mt-1 rounded border border-bad/40 bg-bad/10 px-2 py-1.5 leading-relaxed">
            <div className="text-[11px] text-bad">{error.message}</div>
            {error.line ? (
              <div className="text-[10px] text-bad/70">[line {error.line}]</div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
