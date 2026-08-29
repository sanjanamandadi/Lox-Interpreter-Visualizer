# Lox Interpreter Visualizer — Frontend

An educational visualizer for the Java Lox interpreter in `../src/`, covering
chapters 1–9 of *Crafting Interpreters* (through control flow — no functions or
classes).

## Running it

```bash
cd frontend
npm install     # only needed the first time, or after pulling new dependencies
npm run dev     # starts the dev server and opens http://localhost:5173
```

The Guided Walkthrough works entirely offline from the bundled trace in
`mockData.js`. To trace your *own* programs in Sandbox mode, start the Java
backend too — see [Sandbox mode and the backend](#sandbox-mode-and-the-backend).

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with Hot Module Replacement. Save a file → the page updates in place, keeping your current step. |
| `npm run build` | Production bundle into `dist/`. Also the fastest way to catch errors across every file at once. |
| `npm run preview` | Serves the built `dist/` locally, so you can check the production build before deploying. |

**Windows note:** Node was installed via winget, so a shell opened *before* the
install won't have `node` on its PATH. Open a new terminal and `node --version`
should print `v24.19.0`.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `→` / `j` | Step forward |
| `←` / `k` | Step back |
| `space` | Play / pause |

## Architecture

```
src/
├── main.jsx              entry point — mounts React onto #root
├── index.css             Tailwind import + theme (the colour palette)
├── mockData.js           ★ the bundled sample trace — and the schema the backend matches
├── App.jsx               owns ALL shared state; fetches live traces; passes slices to each panel
└── components/
    ├── Header.jsx            title + Guided/Sandbox toggle
    ├── Panel.jsx             shared panel chrome (header, border, tabs)
    ├── CommentaryBox.jsx     the teaching narration (Guided mode only)
    ├── CodePanel.jsx         Panel 1: source + active line
    ├── StepperControls.jsx   play/pause/step/reset, progress, speed
    ├── SyntaxPanel.jsx       Panel 2: tabs
    │   ├── TokenStream.jsx       Tab 1: Scanner.java output
    │   └── AstTree.jsx          Tab 2: Parser.java output (recursive!)
    ├── RuntimePanel.jsx      Panel 3: tabs
    │   ├── VisitorStack.jsx     Tab 1: the visitor call stack
    │   └── ScopeStack.jsx       Tab 2: the Environment chain
    └── ConsolePanel.jsx      bottom: System.out + runtime errors
```

**The one idea to understand:** `App.jsx` holds `stepIndex`. Every panel receives
a slice of `trace[stepIndex]` and renders it. No panel keeps its own copy of
runtime state, so no two panels can ever disagree about what's happening. That's
why each panel file is short.

The tokens, AST, and trace travel together as one "program bundle" in App's
state, so a live trace can never be shown beside the previous program's AST.
Swapping `mockData`'s bundle for a fetched one is the only difference between
offline and live mode.

Every step in the trace stores the **complete** state at that moment (whole
scope stack, whole output-so-far) rather than a delta. Redundant, but it makes
"Step Back" a one-line operation: `stepIndex - 1`. See the comment at the top of
`mockData.js`.

## Sandbox mode and the backend

The frontend has no scanner or parser of its own — it only *renders* traces. In
Sandbox mode, **Run** POSTs your source to the real Java pipeline in `../src`,
which traces it and returns the same JSON shape `mockData.js` provides.

```bash
# from the repository root
javac -encoding UTF-8 -d bin src/com/craftinginterpreters/lox/*.java
java -cp bin com.craftinginterpreters.lox.TraceServer
# → Lox trace server listening on http://127.0.0.1:8080
```

| Endpoint | Purpose |
|---|---|
| `POST /api/trace` | Body `{"source": "print 1 + 2;"}` → `{tokens, ast, trace, notice}`. A non-JSON `Content-Type` means the body is treated as raw source, which is handy from curl. |
| `GET /api/health` | `{"status":"ok"}` — a cheap way to check the server is up. |

Environment variables: `LOX_TRACE_PORT` (8080), `LOX_TRACE_HOST` (127.0.0.1),
`LOX_TRACE_ORIGIN` (`*`). On the frontend side, `VITE_API_URL` overrides the
endpoint — copy `.env.example` to `.env`.

If the backend isn't running, Run says so in the console and falls back to the
bundled sample trace, so the app is never broken by an absent server. Running the
unmodified sample program skips the network entirely: the hand-written commentary
in `mockData.js` is richer than anything generated.

### Where the trace comes from

| File | Role |
|---|---|
| `TraceExporter.java` | Runs the pipeline and records each step as JSON. |
| `TraceServer.java` | The HTTP endpoint, on `com.sun.net.httpserver`. |
| `Json.java` | A minimal JSON reader/writer — the project has no dependencies. |
| `Interpreter.Probe` | The hook `TraceExporter` implements. `evaluate()` and `execute()` bracket every recursive descent with `enter`/`exit`, which is exactly what the Visitor Stack panel draws. |

Interpretation is observed, never altered: with no probe attached the interpreter
runs exactly as before, and a probe only ever reads state.

Two limits worth knowing: source is capped at 20,000 characters, and a trace at
4,000 steps. The step cap is what stops `while (true) {}` from hanging the server
— you get the first 4,000 steps plus a note saying the trace was truncated.

## Two-week learning plan

Roughly 2 hrs/day. The pattern each day: **read the code → change one thing →
build one thing unaided.** Reading alone doesn't stick; breaking something does.

### Week 1 — foundations, using this codebase as the textbook

| Day | Learn | Build |
|---|---|---|
| 1 | JS essentials: `import`/`export`, arrow functions, `map`/`filter`, destructuring, spread, template literals. What Vite is (dev server + HMR + bundler). | Edit `SAMPLE_SOURCE` in `mockData.js`, watch HMR update instantly. |
| 2 | Components, JSX, props, one-way data flow. | Read `TokenStream.jsx`; add a column showing each token's index in hex. |
| 3 | `useState`, event handlers, why state lives in `App` not in the panels. | Delete the Reset button, then rebuild it from scratch. |
| 4 | Rendering lists, the `key` prop, conditional rendering with `&&`. | Add a third tab to Panel 2 showing raw trace JSON for the current step. |
| 5 | `useEffect`, `setInterval`, cleanup functions. | Read App's autoplay effect. Delete the `clearInterval` and observe the bug — then put it back. |
| 6–7 | Tailwind: utility-first CSS, flex vs. grid, responsive prefixes, `@theme`. | Restyle `ConsolePanel` from scratch. Then add a light theme with `dark:` variants. |

### Week 2 — build, don't read

| Day | Learn | Build |
|---|---|---|
| 8 | Recursive components — `AstNode` renders itself, exactly like recursive descent. | Add "collapse all" / "expand all" buttons. (Hint: you'll have to lift `collapsed` out of `AstNode`.) |
| 9 | Prop drilling and why it hurts; `useContext`. | Move trace state into a context so `CodePanel` stops forwarding stepper props. |
| 10 | Custom hooks — extracting logic from components. | Pull all the stepping logic out of `App.jsx` into `useTrace()`. |
| 11 | Accessibility: real `<button>`s, `aria-label`, focus, keyboard nav. | Add a `?` overlay listing the shortcuts. |
| 12 | **The backend.** JSON serialization in Java, `fetch()`, async state. | Read `TraceExporter.java` and `App.jsx`'s `fetchTrace`, then add a new commentary case for a node type. |
| 13 | Why components re-render; `memo`; React DevTools profiler. | Profile a 500-step trace. Find what re-renders needlessly. |
| 14 | `vite build`, static hosting. | Deploy to Vercel or GitHub Pages. Write the README yourself. |

### The mental bridge

**React is a tree-walking interpreter.** It takes a tree (JSX elements),
recursively visits each node, and produces output (DOM). Your `Interpreter.java`
takes a tree (`Expr`/`Stmt`), recursively visits each node, and produces output
(values and side effects). Same pattern, different output medium.

`AstTree.jsx` is quite literally a visitor over your AST. When React's model
feels alien, come back to this: you have already written this program, in Java.

## Stack

- **[Vite](https://vite.dev) 8** — dev server + build tool
- **[React](https://react.dev) 19** — UI library
- **[Tailwind CSS](https://tailwindcss.com) 4** — utility-first CSS.
  Note: v4 has **no** `tailwind.config.js` and no PostCSS config — it uses the
  `@tailwindcss/vite` plugin plus the `@theme` block in `index.css`. Tutorials
  telling you to run `npx tailwindcss init` are written for v3.
- **[lucide-react](https://lucide.dev) 1** — icons.
  Note: v1 renamed many icons (`Code2` → `CodeXml`, `AlertTriangle` →
  `TriangleAlert`) and dropped brand icons like `Github`. Check
  [lucide.dev/icons](https://lucide.dev/icons) if an import fails.
