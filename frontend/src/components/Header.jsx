import { BookOpen, ExternalLink, FlaskConical, Keyboard } from "lucide-react";

/**
 * Header — title, keyboard hints, and the Guided / Sandbox toggle.
 *
 * Props:
 *   mode          "guided" | "sandbox"
 *   onModeChange  called with the requested mode
 *
 * Holds no state of its own: `mode` lives in App because CodePanel needs it too,
 * and Header only receives the value plus a way to ask for a new one.
 */
export default function Header({ mode, onModeChange }) {
  const modes = [
    { id: "guided", label: "Guided Walkthrough", icon: BookOpen },
    { id: "sandbox", label: "Sandbox", icon: FlaskConical },
  ];

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-edge bg-panel px-4 py-2">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-semibold text-bright">
          Lox Interpreter Visualizer
        </h1>
        <span className="hidden text-[11px] text-dim sm:inline">
          Scanner → Parser → Tree-Walking Interpreter
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-[11px] text-dim lg:flex">
          <Keyboard size={12} aria-hidden="true" />
          <kbd className="rounded border border-edge px-1">←</kbd>
          <kbd className="rounded border border-edge px-1">→</kbd>
          step
          <kbd className="ml-1 rounded border border-edge px-1">space</kbd>
          play
        </span>

        {/* A segmented control. role="group" tells screen readers these two
            buttons belong together. */}
        <div
          role="group"
          aria-label="Visualizer mode"
          className="flex rounded-md border border-edge p-0.5"
        >
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onModeChange(id)}
              aria-pressed={mode === id}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
                mode === id
                  ? "bg-runtime/15 text-runtime"
                  : "text-dim hover:text-bright"
              }`}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <a
          href="https://craftinginterpreters.com"
          target="_blank"
          rel="noreferrer"
          className="text-dim transition-colors hover:text-bright"
          aria-label="Crafting Interpreters"
        >
          <ExternalLink size={15} />
        </a>
      </div>
    </header>
  );
}
