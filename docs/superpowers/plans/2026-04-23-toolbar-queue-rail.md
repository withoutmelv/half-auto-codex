# Toolbar Queue Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the global toolbar and make the left task queue easier to scan.

**Architecture:** Keep the change inside the renderer shell. `src/renderer/App.tsx` owns action placement and task-list markup; `src/renderer/styles.css` owns Azure Clarity visual treatment; `tests/appSource.test.ts` locks key source-level UI structure.

**Tech Stack:** React, TypeScript, CSS, Vitest

---

## File Structure

- Modify: `tests/appSource.test.ts` — add source assertions for slim toolbar, editor task actions, and queue rail markers.
- Modify: `src/renderer/App.tsx` — move task actions out of the toolbar and add queue rail markup.
- Modify: `src/renderer/styles.css` — update top bar, queue rail, and selected task styling using `DESIGN.md` tokens.
- Reference: `DESIGN.md` — Azure Clarity visual constraints.

## Task 1: Lock the UI structure with tests

- [ ] **Step 1: Add source tests**

Add tests that assert:

```ts
expect(toolbarSource).not.toContain("运行所选任务");
expect(toolbarSource).not.toContain("重试任务");
expect(toolbarSource).not.toContain("跳过任务");
expect(appSource).toContain("editor-actions");
expect(appSource).toContain("job-step-marker");
expect(appSource).toContain("formatDirectoryLabel(job.cwd)");
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/appSource.test.ts`

Expected: FAIL because current toolbar still contains task-level actions and the queue rail marker does not exist.

## Task 2: Move actions and improve queue markup

- [ ] **Step 1: Add a directory formatter**

Add `formatDirectoryLabel(cwd: string): string` in `src/renderer/App.tsx`.

- [ ] **Step 2: Slim the toolbar**

Replace the current toolbar action group with `保存队列` and one dynamic `启动队列` / `停止队列` button.

- [ ] **Step 3: Add editor action groups**

Add `editor-actions`, `task-run-actions`, and `task-edit-actions` containers in the editor panel header.

- [ ] **Step 4: Add queue rail markup**

Update each `.job-item` to include `.job-step-marker`, `.job-item-content`, `.job-item-title`, and `.job-item-detail`.

- [ ] **Step 5: Run source tests**

Run: `npm test -- tests/appSource.test.ts`

Expected: PASS.

## Task 3: Apply Azure Clarity styling

- [ ] **Step 1: Update CSS variables**

Switch root variables to Azure Clarity light surfaces and ghost-border values from `DESIGN.md`.

- [ ] **Step 2: Style toolbar, editor actions, and queue rail**

Add compact toolbar actions, stacked editor action groups, task rail marker states, and selected task tonal layering.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all pass.

## Self-Review

- Spec coverage: Covers toolbar simplification and left queue rail display.
- Placeholder scan: No unresolved placeholders remain.
- Type consistency: Uses existing `QueueJob`, `QueueDefinition`, `RunnerOutputEvent`, and local handler names.
- Design consistency: Uses `DESIGN.md` Azure Clarity palette, ghost borders, rounded controls, and tonal layering.
