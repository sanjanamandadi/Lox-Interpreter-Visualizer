import { useCallback, useEffect, useMemo, useState } from "react";
import { AST, SAMPLE_SOURCE, TOKENS, TRACE } from "./mockData.js";
import Header from "./components/Header.jsx";
import CodePanel from "./components/CodePanel.jsx";
import SyntaxPanel from "./components/SyntaxPanel.jsx";
import RuntimePanel from "./components/RuntimePanel.jsx";
import ConsolePanel from "./components/ConsolePanel.jsx";
import CommentaryBox from "./components/CommentaryBox.jsx";

/**
 * Where the Java trace backend lives. Override at build time with a
 * VITE_API_URL entry in `frontend/.env` (see `.env.example`); Vite inlines
 * `import.meta.env.*` values, so only variables prefixed VITE_ are exposed.
 */
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080/api/trace";

/** Give up on the backend after this long, so a hung request can't wedge the UI. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * A "program bundle" is everything the panels need to render one execution:
 * the token stream, the AST, and the step-by-step trace. Keeping the three in a
 * single state object means they can never drift out of sync — you cannot end up
 * showing last program's AST beside this program's trace.
 */
const SAMPLE_PROGRAM = { tokens: TOKENS, ast: AST, trace: TRACE };

/**
 * Index of the first step of each pipeline phase, for the jump-to-phase buttons.
 * Derived from the trace rather than hard-coded, so it stays correct for traces
 * that arrive from the backend as well as the bundled sample.
 */
function findPhaseStarts(trace) {
  const starts = {};
  trace.forEach((step, index) => {
    if (starts[step.phase] === undefined) starts[step.phase] = index;
  });
  return starts;
}

/**
 * POST Lox source to the backend and return a { tokens, ast, trace } bundle plus
 * the backend's own `notice` (a truncated trace, a program that failed to parse).
 * Throws unless the response is a usable trace, so the caller can decide how to
 * fall back rather than rendering a half-empty visualizer.
 */
async function fetchTrace(source, signal) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`backend responded ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data.trace) || data.trace.length === 0) {
    throw new Error("backend returned no trace steps");
  }

  return {
    program: {
      tokens: Array.isArray(data.tokens) ? data.tokens : [],
      ast: data.ast ?? null,
      trace: data.trace,
    },
    notice: typeof data.notice === "string" ? data.notice : null,
  };
}

/**
 * App — the only component that owns the state everything else depends on.
 *
 * The architecture in one sentence: App holds `stepIndex`, looks up
 * `trace[stepIndex]`, and hands pieces of that snapshot to each panel.
 *
 * The panels therefore all read from ONE source of truth and cannot disagree
 * with each other, because no panel keeps its own copy of the runtime state. If
 * the AST tab highlights node e3r, the scope panel is showing the environment at
 * that exact instant, for free.
 */
export default function App() {
  const [mode, setMode] = useState("guided"); // "guided" | "sandbox"
  const [source, setSource] = useState(SAMPLE_SOURCE);
  const [program, setProgram] = useState(SAMPLE_PROGRAM);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(700); // ms between steps
  const [notice, setNotice] = useState(null);

  const { tokens, ast, trace } = program;

  // The current snapshot. Everything below is derived from this one object.
  // The `?? trace[0]` guard keeps a stale index from blanking the UI in the
  // instant between swapping in a shorter trace and resetting stepIndex.
  const step = trace[stepIndex] ?? trace[0];
  const atEnd = stepIndex >= trace.length - 1;

  const phaseStarts = useMemo(() => findPhaseStarts(trace), [trace]);

  // --- Stepping -------------------------------------------------------------
  // These use the updater form, setStepIndex(i => ...), instead of
  // setStepIndex(stepIndex + 1). It reads the freshest value at the moment
  // React applies it, which matters for the autoplay timer below: that closure
  // is created once, so a direct reference to `stepIndex` would be frozen at
  // whatever it was when the timer started, and playback would jam on step 2.
  //
  // useCallback keeps the same function identity between renders, so the
  // useEffect below doesn't tear down and rebuild the interval on every step.
  const next = useCallback(
    () => setStepIndex((i) => Math.min(i + 1, trace.length - 1)),
    [trace.length]
  );
  const prev = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), []);
  const reset = useCallback(() => {
    setStepIndex(0);
    setIsPlaying(false);
  }, []);
  const jumpTo = useCallback((index) => {
    setStepIndex(index);
    setIsPlaying(false);
  }, []);

  // --- Autoplay -------------------------------------------------------------
  // The returned function is the cleanup: React calls it before re-running the
  // effect and when the component unmounts. Without clearInterval, a new timer
  // would stack up on every render until the stepper sprints.
  useEffect(() => {
    if (!isPlaying) return;
    if (atEnd) {
      setIsPlaying(false);
      return;
    }
    const id = setInterval(next, speed);
    return () => clearInterval(id);
  }, [isPlaying, atEnd, speed, next]);

  // --- Keyboard shortcuts ---------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event) => {
      // Don't hijack arrow keys while someone is typing in the editor.
      if (event.target.tagName === "TEXTAREA") return;

      if (event.key === "ArrowRight" || event.key === "j") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft" || event.key === "k") {
        event.preventDefault();
        prev();
      } else if (event.key === " ") {
        event.preventDefault(); // space would otherwise scroll the page
        setIsPlaying((playing) => !playing);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, prev]);

  /** Restore the bundled sample program and its hand-written commentary. */
  const loadSample = useCallback(() => {
    setSource(SAMPLE_SOURCE);
    setProgram(SAMPLE_PROGRAM);
    setStepIndex(0);
    setIsPlaying(false);
    setNotice(null);
  }, []);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setIsPlaying(false);
    setStepIndex(0);
    if (nextMode === "guided") {
      loadSample();
    } else {
      setNotice(
        `Sandbox mode: edit the program and press Run to trace it with the Java backend at ${API_URL}. ` +
          "If the backend isn't running you'll get the sample trace back, with a note saying so."
      );
    }
  };

  // --- Sandbox "Run" --------------------------------------------------------
  // The frontend has no scanner or parser of its own — it only renders traces.
  // So Run either replays the bundled sample or asks the real Java pipeline for
  // a fresh trace of whatever the user typed.
  const handleRun = async () => {
    setIsPlaying(false);
    setStepIndex(0);

    // The sample ships with hand-written commentary that is far richer than the
    // backend's generated narration, so prefer it when the code is unchanged.
    if (source.trim() === SAMPLE_SOURCE.trim()) {
      setProgram(SAMPLE_PROGRAM);
      setNotice(null);
      return;
    }

    // AbortController is the standard way to cancel a fetch; pairing it with a
    // timer turns "no response" into a normal error instead of a spinner that
    // never stops.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    setIsRunning(true);
    setNotice(null);
    try {
      const result = await fetchTrace(source, controller.signal);
      setProgram(result.program);
      // The backend flags things the trace itself can't express: a program that
      // failed to parse, or one truncated because it never terminated.
      setNotice(result.notice);
    } catch (error) {
      const reason =
        error.name === "AbortError"
          ? `no response within ${REQUEST_TIMEOUT_MS / 1000}s`
          : error.message;
      setProgram(SAMPLE_PROGRAM);
      setNotice(
        `Couldn't trace that program (${reason}). Start the Java backend with ` +
          "`java com.craftinginterpreters.lox.TraceServer`, or check VITE_API_URL. " +
          "Showing the bundled sample trace in the meantime."
      );
    } finally {
      clearTimeout(timeoutId);
      setIsRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Header mode={mode} onModeChange={handleModeChange} />

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        {/* Narration for both modes: backend traces carry commentary of their
            own, so hiding it in Sandbox would throw away the explanation of
            whatever the user just ran. */}
        <CommentaryBox
          step={step}
          stepIndex={stepIndex}
          totalSteps={trace.length}
        />


        {/*
          The 3-panel grid. One column on narrow screens, three from `lg` up
          (1024px) — Tailwind's responsive prefixes are mobile-first, so an
          unprefixed class is the small-screen default and `lg:` overrides it.

          [&>section]:min-h-[280px] applies a utility to every direct <section>
          child (each Panel renders one). Without a minimum height, stacked
          panels would collapse to nothing on a phone; on desktop we drop it
          again so they share the height evenly.
        */}
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto [&>section]:min-h-[280px] lg:grid-cols-3 lg:overflow-hidden lg:[&>section]:min-h-0">
          <CodePanel
            source={source}
            onSourceChange={setSource}
            activeLine={step.line}
            mode={mode}
            onRun={handleRun}
            onLoadSample={loadSample}
            isRunning={isRunning}
            // Stepper props, forwarded through CodePanel to StepperControls.
            stepIndex={stepIndex}
            totalSteps={trace.length}
            isPlaying={isPlaying}
            speed={speed}
            phase={step.phase}
            phaseStarts={phaseStarts}
            onNext={next}
            onPrev={prev}
            onTogglePlay={() => setIsPlaying((playing) => !playing)}
            onReset={reset}
            onSpeedChange={setSpeed}
            onJumpToPhase={jumpTo}
          />

          <SyntaxPanel
            tokens={tokens}
            ast={ast}
            phase={step.phase}
            activeTokenIndex={step.tokenIndex}
            activeLine={step.line}
            activeAstId={step.astNodeId}
          />

          <RuntimePanel
            stack={step.stack}
            scopes={step.scopes}
            phase={step.phase}
          />
        </main>

        <div className="h-36 shrink-0 lg:h-32">
          <ConsolePanel output={step.output} error={step.error} notice={notice} />
        </div>
      </div>
    </div>
  );
}
