import { CodeXml, LoaderCircle, Play, RotateCcw } from "lucide-react";
import Panel from "./Panel.jsx";
import StepperControls from "./StepperControls.jsx";

/**
 * CodePanel (Panel 1) — the source view with active-line highlighting, plus the
 * stepper controls underneath.
 *
 * Props:
 *   source / onSourceChange   the Lox program and how to update it
 *   activeLine                1-based line to highlight, or null
 *   mode                      "guided" (read-only) | "sandbox" (editable)
 *   onRun                     ask the backend to trace the edited program
 *   onLoadSample              restore the bundled sample program
 *   isRunning                 a trace request is in flight
 *   ...rest                   forwarded to StepperControls
 *
 * The editor is a plain <textarea> rather than CodeMirror or Monaco: swapping in
 * a real editor later touches only this file, and a megabyte of editor
 * dependency buys nothing while the programs are twenty lines long.
 */
export default function CodePanel({
  source,
  onSourceChange,
  activeLine,
  mode,
  onRun,
  onLoadSample,
  isRunning = false,
  ...stepperProps
}) {
  // Split into lines so we can render each one separately and highlight one.
  const lines = source.split("\n");
  const isSandbox = mode === "sandbox";

  return (
    <Panel title="Source" icon={CodeXml} accent="runtime">
      <div className="flex h-full min-h-0 flex-col">
        {isSandbox && (
          <div className="flex shrink-0 items-center gap-2 border-b border-edge px-3 py-1.5">
            <button
              onClick={onRun}
              disabled={isRunning}
              className="flex items-center gap-1.5 rounded bg-good/15 px-2 py-1 text-xs text-good transition-colors hover:bg-good/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? (
                <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Play size={12} aria-hidden="true" />
              )}
              {isRunning ? "Tracing…" : "Run"}
            </button>
            <button
              onClick={onLoadSample}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-dim transition-colors hover:bg-panel-hi hover:text-bright"
            >
              <RotateCcw size={12} aria-hidden="true" /> Restore sample
            </button>
            <span className="ml-auto text-[10px] text-dim">editable</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {isSandbox ? (
            /* A controlled textarea: `value` comes from state, and every
               keystroke fires onChange, which updates state, which re-renders
               with the new value. React state stays the single source of truth. */
            <textarea
              value={source}
              onChange={(e) => onSourceChange(e.target.value)}
              spellCheck={false}
              className="h-full min-h-[220px] w-full resize-none bg-transparent p-3 text-xs leading-6 text-bright outline-none"
              aria-label="Lox source code"
            />
          ) : (
            <pre className="p-3 text-xs leading-6">
              {lines.map((line, index) => {
                const lineNumber = index + 1; // source lines are 1-based
                const isActive = lineNumber === activeLine;
                return (
                  <div
                    key={lineNumber}
                    className={`-mx-3 flex px-3 transition-colors ${
                      isActive ? "bg-runtime/15" : ""
                    }`}
                  >
                    <span
                      className={`mr-3 w-6 shrink-0 select-none text-right ${
                        isActive ? "text-runtime" : "text-dim/50"
                      }`}
                    >
                      {lineNumber}
                    </span>
                    {/* A left bar on the active line — a second visual cue, so
                        the highlight doesn't rely on colour alone. */}
                    <span
                      className={`mr-2 w-0.5 shrink-0 ${isActive ? "bg-runtime" : "bg-transparent"}`}
                      aria-hidden="true"
                    />
                    <code className={isActive ? "text-bright" : "text-bright/75"}>
                      {/* An empty line would collapse to zero height, so a
                          non-breaking space keeps the numbering aligned. */}
                      {line || " "}
                    </code>
                  </div>
                );
              })}
            </pre>
          )}
        </div>

        <StepperControls {...stepperProps} />
      </div>
    </Panel>
  );
}
