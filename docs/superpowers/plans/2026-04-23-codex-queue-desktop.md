# Codex Queue Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron desktop app that runs structured Codex jobs sequentially, with one or more plan files per job and queue advancement gated by the previous `codex exec` process exit.

**Architecture:** Electron `main` owns child processes, queue orchestration, file access, and persistence. `renderer` owns the three-column desktop UI and talks to `main` through a constrained `preload` API. Pure TypeScript modules cover prompt assembly and queue state transitions so they can be tested without Electron.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Node `child_process`, Node filesystem APIs.

---

## File Structure

- Create: `package.json` — npm scripts and dependencies.
- Create: `tsconfig.json` — shared strict TypeScript settings.
- Create: `tsconfig.main.json` — Electron main/preload compilation.
- Create: `vite.config.ts` — React renderer build and Vitest config.
- Create: `index.html` — renderer HTML entry.
- Create: `src/shared/types.ts` — queue, job, status, runner, IPC types.
- Create: `src/main/prompt.ts` — plan file loading and prompt assembly.
- Create: `src/main/queueEngine.ts` — serial queue state machine.
- Create: `src/main/codexRunner.ts` — `codex exec <PROMPT>` process runner and logs.
- Create: `src/main/persistence.ts` — app-data queue and run directory helpers.
- Create: `src/main/ipc.ts` — validated IPC handlers and event forwarding.
- Create: `src/main/main.ts` — Electron app bootstrap.
- Create: `src/preload.ts` — safe renderer API.
- Create: `src/renderer/main.tsx` — React entry.
- Create: `src/renderer/App.tsx` — queue editor, runner controls, logs.
- Create: `src/renderer/styles.css` — UI styles strictly following `DESIGN.md`.
- Create: `tests/prompt.test.ts` — prompt assembly tests.
- Create: `tests/queueEngine.test.ts` — serial execution and failure-stop tests.
- Create: `tests/codexRunner.test.ts` — command argument and log parsing tests with a stub executable.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.main.json`
- Create: `vite.config.ts`
- Create: `index.html`

- [ ] **Step 1: Add npm project metadata**

Create `package.json` with:

```json
{
  "name": "codex-queue-desktop",
  "version": "0.1.0",
  "private": true,
  "main": "dist-electron/main/main.js",
  "scripts": {
    "dev": "concurrently -k \"vite\" \"tsc -p tsconfig.main.json --watch\" \"wait-on http://localhost:5173 dist-electron/main/main.js && ELECTRON_RENDERER_URL=http://localhost:5173 electron .\"",
    "build": "tsc -p tsconfig.main.json && vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.main.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "electron": "latest",
    "concurrently": "latest",
    "wait-on": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Add TypeScript configs**

Create `tsconfig.json` for renderer and tests, and `tsconfig.main.json` for Electron main/preload output into `dist-electron`.

- [ ] **Step 3: Add Vite entry**

Create `vite.config.ts` with React plugin and Vitest node environment.

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `node_modules/` and `package-lock.json` are created.

## Task 2: Shared Types and Prompt Builder

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/main/prompt.ts`
- Create: `tests/prompt.test.ts`

- [ ] **Step 1: Write failing prompt tests**

Cover ordered multi-plan injection, missing files, and prompt header fields.

- [ ] **Step 2: Implement shared types**

Define `QueueJob`, `QueueDefinition`, `JobStatus`, `CodexOptions`, `RunArtifacts`, `JobRunResult`, and runner callback types.

- [ ] **Step 3: Implement prompt builder**

Implement `loadPlanFiles(job)` and `buildPrompt(job, plans)` so the output matches the spec template.

- [ ] **Step 4: Run prompt tests**

Run: `npm test -- tests/prompt.test.ts`

Expected: prompt tests pass.

## Task 3: Queue Engine

**Files:**
- Create: `src/main/queueEngine.ts`
- Create: `tests/queueEngine.test.ts`

- [ ] **Step 1: Write failing queue tests**

Cover single-running invariant, success advancing, failure stopping, stop behavior, skip, and retry.

- [ ] **Step 2: Implement queue engine**

Create an `EventEmitter`-based `QueueEngine` that owns queue state, emits snapshots, and starts jobs through an injected runner.

- [ ] **Step 3: Run queue tests**

Run: `npm test -- tests/queueEngine.test.ts`

Expected: queue tests pass.

## Task 4: Codex Runner and Persistence

**Files:**
- Create: `src/main/persistence.ts`
- Create: `src/main/codexRunner.ts`
- Create: `tests/codexRunner.test.ts`

- [ ] **Step 1: Write failing runner tests**

Use a temporary stub executable that emits stdout/stderr and exits with controlled codes.

- [ ] **Step 2: Implement persistence helpers**

Create helpers for `queues/` and timestamped `runs/<queue-id>/<job-id>/<run-id>/` directories.

- [ ] **Step 3: Implement Codex runner**

Spawn `codex exec <PROMPT>`, pass the task instruction and plan paths as the prompt argument, and write `stdout.log`, `stderr.log`, and `meta.json`.

- [ ] **Step 4: Run runner tests**

Run: `npm test -- tests/codexRunner.test.ts`

Expected: runner tests pass.

## Task 5: Electron IPC and Bootstrap

**Files:**
- Create: `src/main/ipc.ts`
- Create: `src/main/main.ts`
- Create: `src/preload.ts`

- [ ] **Step 1: Implement bootstrap**

Create the Electron `BrowserWindow`, load Vite dev server in development, load `dist/index.html` in production, and wire app lifecycle.

- [ ] **Step 2: Implement IPC handlers**

Expose queue load/save/start/stop/retry/skip/run-selected handlers, directory picker, plan-file picker, and event subscriptions.

- [ ] **Step 3: Implement preload API**

Expose a narrow `window.codexQueue` API with typed methods and unsubscribe functions.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: TypeScript compiles without errors.

## Task 6: Renderer UI

**Files:**
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/styles.css`

- [ ] **Step 1: Re-read design rules**

Read `DESIGN.md` before writing CSS and only use its defined colors, spacing, fonts, radius, shadows, and motion rules.

- [ ] **Step 2: Implement React UI**

Build the three-column layout: queue list, task editor, run/log panel, and toolbar controls.

- [ ] **Step 3: Implement CSS**

Style all UI using only `DESIGN.md` tokens and allowed component patterns.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: Electron main and renderer build successfully.

## Task 7: Final Verification

**Files:**
- Modify as needed only when failures point to changed files.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all Vitest tests pass.

- [ ] **Step 2: Run full typecheck**

Run: `npm run typecheck`

Expected: no TypeScript errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: `dist/` and `dist-electron/` are generated.

## Self-Review

- Spec coverage: tasks cover Electron architecture, structured jobs, multi-plan prompt assembly, `codex exec <PROMPT>`, serial queue execution, failure-stop behavior, persistence, logs, UI, and tests.
- Placeholder review: no unresolved marker words or vague deferred steps remain.
- Type consistency: status values match the design spec, including `skipped` and `interrupted`.
- Repository note: current directory is not a git repository, so commit steps are intentionally omitted.
