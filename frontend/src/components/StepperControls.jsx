import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";

/** Reusable icon button so all four transport controls stay visually identical. */
function IconButton({ icon: Icon, label, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      // aria-label is essential here: the button's only visible content is an
      // icon, so a screen reader would otherwise announce it as just "button".
      aria-label={label}
      title={label}
      className={`rounded p-1.5 transition-colors ${
        active
          ? "bg-runtime/20 text-runtime"
          : "text-dim hover:bg-panel-hi hover:text-bright"
      } disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
    >
      <Icon size={16} />
    </button>
  );
}

/**
 * StepperControls — transport buttons, a phase-aware progress bar, and speed.
 *
 * Props:
 *   stepIndex / totalSteps   position in the trace
 *   isPlaying                whether autoplay is running
 *   speed                    ms between autoplay steps
 *   phase                    current phase, used to tint the progress bar
 *   phaseStarts              { scan, parse, interpret } → first step index of each
 *   onNext / onPrev / onTogglePlay / onReset / onSpeedChange / onJumpToPhase
 *
 * Every button here does exactly one thing: call a function it was handed via
 * props. It stores nothing, so it cannot get out of sync with the rest of the app.
 */
export default function StepperControls({
  stepIndex,
  totalSteps,
  isPlaying,
  speed,
  phase,
  phaseStarts = {},
  onNext,
  onPrev,
  onTogglePlay,
  onReset,
  onSpeedChange,
  onJumpToPhase,
}) {
  const atStart = stepIndex === 0;
  const atEnd = stepIndex >= totalSteps - 1;
  const percent = totalSteps > 1 ? (stepIndex / (totalSteps - 1)) * 100 : 0;

  const phases = [
    { id: "scan", label: "Scan", color: "bg-scan", text: "text-scan" },
    { id: "parse", label: "Parse", color: "bg-parse", text: "text-parse" },
    { id: "interpret", label: "Interpret", color: "bg-runtime", text: "text-runtime" },
  ];
  const activeBar =
    phases.find((p) => p.id === phase)?.color ?? "bg-runtime";

  return (
    <div className="shrink-0 space-y-2 border-t border-edge px-3 py-2">
      <div className="flex items-center gap-1">
        <IconButton icon={RotateCcw} label="Reset to first step" onClick={onReset} disabled={atStart} />
        <IconButton icon={ChevronLeft} label="Step back" onClick={onPrev} disabled={atStart} />
        <IconButton
          icon={isPlaying ? Pause : Play}
          label={isPlaying ? "Pause" : "Play"}
          onClick={onTogglePlay}
          disabled={atEnd}
          active={isPlaying}
        />
        <IconButton icon={ChevronRight} label="Step next" onClick={onNext} disabled={atEnd} />

        <span className="ml-2 text-[11px] text-dim">
          step{" "}
          <span className="text-bright">{stepIndex + 1}</span>
          {" / "}
          {totalSteps}
        </span>

        {/* A controlled range input: React state is the source of truth and the
            slider merely reflects it. */}
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-dim">
          <Gauge size={12} aria-hidden="true" />
          <input
            type="range"
            min="120"
            max="1600"
            step="20"
            // Inverted so dragging right = faster, which is what people expect.
            value={1720 - speed}
            onChange={(e) => onSpeedChange(1720 - Number(e.target.value))}
            className="h-1 w-16 accent-runtime"
            aria-label="Playback speed"
          />
        </label>
      </div>

      {/* Progress bar, tinted by the current phase. */}
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-edge"
        role="progressbar"
        aria-valuenow={stepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
      >
        <div
          className={`h-full rounded-full transition-all duration-200 ${activeBar}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Jump-to-phase shortcuts. Being able to skip straight to interpretation
          matters: someone revisiting the runtime shouldn't re-watch scanning.
          A phase with no steps (a program that failed to parse never reaches
          interpretation) has no entry in phaseStarts, so its button is disabled
          rather than jumping to step 0. */}
      <div className="flex gap-1">
        {phases.map((p) => {
          const start = phaseStarts[p.id];
          return (
            <button
              key={p.id}
              onClick={() => onJumpToPhase(start)}
              disabled={start === undefined}
              className={`flex-1 rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${
                phase === p.id
                  ? `border-edge bg-panel-hi ${p.text}`
                  : "border-transparent text-dim hover:bg-panel-hi hover:text-bright"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
