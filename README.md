# Lox Interpreter & Execution Visualizer

An interactive visualizer for a Java-based **Lox interpreter** (*Crafting Interpreters* by Robert Nystrom, Chapters 1–9).

The application captures real-time state from the Java interpreter, including lexical tokens, AST nodes, visitor call stacks, and environment scope chains—and streams them to an interactive frontend.

**Live Demo:** [https://lox-interpreter.vercel.app](https://lox-interpreter.vercel.app)

---

## Architecture & Tech Stack

* **Backend:** Java 17 (`com.sun.net.httpserver`), Docker, Render
* **Frontend:** React 19, Vite 8, Tailwind CSS v4, Lucide Icons, Vercel

```text
lox-interpreter/
├── src/                                    # Java Lox Interpreter & Trace Engine
│   └── com/craftinginterpreters/lox/
│       ├── TraceServer.java                # Lightweight HTTP Server
│       ├── TraceExporter.java              # State capture hook & probe
│       └── Json.java                       # Zero-dependency JSON serializer
├── frontend/                               # React + Vite Visualizer UI
├── Dockerfile                              # Container configuration for Render
└── README.md
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `→` / `j` | Step forward |
| `←` / `k` | Step back |
| `Space` | Play / Pause |

---

## Running Locally

### 1. Backend (Java)
``` Bash
javac -encoding UTF-8 -d bin src/com/craftinginterpreters/lox/*.java
java -cp bin com.craftinginterpreters.lox.TraceServer
```

### 2. Frontend (React)
``` Bash
cd frontend
npm install
npm run dev
```
