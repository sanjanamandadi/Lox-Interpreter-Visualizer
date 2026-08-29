import { GraduationCap } from "lucide-react";

/** Each phase gets its own colour and a plain-English subtitle. */
const PHASE_INFO = {
  scan: {
    label: "Scanning",
    file: "Scanner.java",
    blurb: "characters → tokens",
    accent: "text-scan",
    border: "border-scan/40",
    bg: "bg-scan/10",
  },
  parse: {
    label: "Parsing",
    file: "Parser.java",
    blurb: "tokens → syntax tree",
    accent: "text-parse",
    border: "border-parse/40",
    bg: "bg-parse/10",
  },
  interpret: {
    label: "Interpreting",
    file: "Interpreter.java",
    blurb: "tree → values & effects",
    accent: "text-runtime",
    border: "border-runtime/40",
    bg: "bg-runtime/10",
  },
};

/**
 * CommentaryBox — the narration for Guided mode.
 *
 * Props:
 *   step                    the current trace step; only `phase` and `commentary` are used
 *   stepIndex / totalSteps  position in the trace, shown top-right
 *
 * A separate component so Sandbox mode can leave it out by simply not rendering
 * it — no flags to thread through, no conditionals inside a bigger component.
 */
export default function CommentaryBox({ step, stepIndex, totalSteps }) {
  // Fall back rather than throw: an unrecognised phase should degrade to plain
  // narration, not blank the whole app.
  const info = PHASE_INFO[step.phase] ?? PHASE_INFO.interpret;

  return (
    <div className={`shrink-0 rounded-lg border ${info.border} ${info.bg} px-3 py-2`}>
      <div className="mb-1 flex items-center gap-2">
        <GraduationCap size={13} className={info.accent} aria-hidden="true" />
        <span className={`text-[11px] font-semibold ${info.accent}`}>
          {info.label}
        </span>
        <span className="text-[10px] text-dim">
          {info.file} · {info.blurb}
        </span>
        <span className="ml-auto text-[10px] text-dim">
          {stepIndex + 1}/{totalSteps}
        </span>
      </div>

      {/* whitespace-pre-line makes \n in the commentary render as real line
          breaks; HTML collapses whitespace by default. */}
      <p className="text-[11px] leading-relaxed whitespace-pre-line text-bright/85">
        {step.commentary}
      </p>
    </div>
  );
}
