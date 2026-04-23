# Job Editor Field Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the job editor so the `浏览目录` button sits to the right of the `工作目录` title, and render `计划文件` before `任务说明`.

**Architecture:** Keep the change scoped to the existing renderer form in `src/renderer/App.tsx`. Reuse the existing `field-label-row` structure so the layout change follows the current component patterns and avoids introducing new visual tokens outside `DESIGN.md`.

**Tech Stack:** React, TypeScript, Vite, Vitest

---

## File Structure

- Modify: `tests/appSource.test.ts` — source-based regression checks for editor field grouping and field order.
- Modify: `src/renderer/App.tsx` — move the directory picker button into the work-directory label row and reorder the plan/instruction blocks.
- Reference only: `DESIGN.md` — confirm the implementation reuses existing layout primitives and does not introduce off-spec borders, colors, or spacing.

**Repository note:** The current workspace is not a Git repository, so commit steps are intentionally omitted from this plan.

## Task 1: Lock the editor layout with failing tests

**Files:**
- Modify: `tests/appSource.test.ts`
- Reference: `DESIGN.md`

- [ ] **Step 1: Re-read the design rules before touching renderer markup**

Review these `DESIGN.md` constraints and keep them unchanged during implementation:

```text
- Reuse existing layout structures instead of adding new borders or divider lines.
- Keep controls ergonomic with the current rounded treatment.
- Avoid introducing ad-hoc colors, spacing systems, or one-off visual effects.
```

- [ ] **Step 2: Add failing source assertions for the new job-editor layout**

Append these tests to `tests/appSource.test.ts`:

```ts
test("App source places the browse directory button in the work-directory label row", () => {
  expect(appSource).toMatch(
    /<label className="field field-wide">\s*<div className="field-label-row">\s*<span>工作目录<\/span>[\s\S]*?浏览目录/
  );
});

test("App source renders plan files before the task instruction field", () => {
  expect(appSource.indexOf("<span>计划文件</span>")).toBeLessThan(
    appSource.indexOf("<span>任务说明</span>")
  );
});
```

- [ ] **Step 3: Run the source test to verify it fails**

Run: `npm test -- tests/appSource.test.ts`

Expected: FAIL because `工作目录` still uses a plain `<span>` without `field-label-row`, and `任务说明` still appears before `计划文件`.

## Task 2: Reorder the job editor fields in the renderer

**Files:**
- Modify: `src/renderer/App.tsx`
- Test: `tests/appSource.test.ts`

- [ ] **Step 1: Move the directory picker button into the work-directory title row**

Replace the current `工作目录` block in `src/renderer/App.tsx` with this markup:

```tsx
<label className="field field-wide">
  <div className="field-label-row">
    <span>工作目录</span>
    <button className="button secondary" onClick={() => void handlePickDirectory()} disabled={isRunning}>
      浏览目录
    </button>
  </div>
  <input
    value={selectedJob.cwd}
    onChange={(event) =>
      mutateQueue((draft) => {
        const target = draft.jobs.find((job) => job.id === selectedJob.id);
        if (target) {
          target.cwd = event.target.value;
        }
      })
    }
  />
</label>
```

- [ ] **Step 2: Render the plan-files block before the task-instruction block**

Reorder the two `field-wide` blocks in `src/renderer/App.tsx` so they appear in this sequence:

```tsx
<div className="field field-wide">
  <div className="field-label-row">
    <span>计划文件</span>
    <button className="button secondary" onClick={() => void handlePickPlanFiles()} disabled={isRunning}>
      选择计划文件
    </button>
  </div>
  <div className="plan-list">
    {selectedJob.planFiles.length === 0 ? (
      <div className="plan-item muted">尚未选择计划文件</div>
    ) : (
      selectedJob.planFiles.map((filePath) => (
        <div key={filePath} className="plan-item">
          <span>{filePath}</span>
        </div>
      ))
    )}
  </div>
</div>

<label className="field field-wide">
  <span>任务说明</span>
  <textarea
    rows={8}
    value={selectedJob.instruction}
    onChange={(event) =>
      mutateQueue((draft) => {
        const target = draft.jobs.find((job) => job.id === selectedJob.id);
        if (target) {
          target.instruction = event.target.value;
        }
      })
    }
  />
</label>
```

- [ ] **Step 3: Run the source test to verify the new order and grouping pass**

Run: `npm test -- tests/appSource.test.ts`

Expected: PASS with all `tests/appSource.test.ts` assertions green.

## Task 3: Verify the renderer change is safe to ship

**Files:**
- Modify: `src/renderer/App.tsx`
- Test: `tests/appSource.test.ts`

- [ ] **Step 1: Run typecheck to confirm the JSX refactor is valid**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run the full test suite to catch unrelated renderer regressions**

Run: `npm test`

Expected: PASS with the existing suite green, including `tests/appSource.test.ts`.

- [ ] **Step 3: Run a production build to confirm the renderer still compiles**

Run: `npm run build`

Expected: PASS with Vite and the Electron main build both completing successfully.

## Self-Review

- **Spec coverage:** The plan covers both requested UI changes: moving `浏览目录` beside the `工作目录` title and swapping the visual order of `计划文件` and `任务说明`.
- **Placeholder scan:** No `TBD`, `TODO`, vague “handle later” language, or missing command expectations remain.
- **Type consistency:** All code snippets reuse the current `selectedJob`, `isRunning`, `mutateQueue`, `handlePickDirectory`, and `handlePickPlanFiles` names from `src/renderer/App.tsx`; no new symbols are introduced.
- **Design consistency:** The plan intentionally reuses the existing `field-label-row` helper and avoids introducing new color, border, or spacing rules outside `DESIGN.md`.
