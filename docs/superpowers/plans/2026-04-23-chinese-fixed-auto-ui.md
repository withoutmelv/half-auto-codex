# 中文固定全自动 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将应用 UI 改为中文，并固定任务执行配置为 `danger-full-access` + `fullAuto`。

**Architecture:** 把固定执行配置放在 `src/shared/defaults.ts`，让新任务和旧队列归一化都复用同一逻辑。`src/renderer/App.tsx` 只负责展示中文 UI，不再渲染模型、Profile、Sandbox、Full Auto 控件。

**Tech Stack:** Electron, React, TypeScript, Vitest.

---

### Task 1: 固定默认执行配置

**Files:**
- Modify: `src/shared/defaults.ts`
- Modify: `src/main/ipc.ts`
- Modify: `tests/defaults.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/defaults.test.ts` 中断言 `createDefaultQueueJob()` 返回 `sandbox: "danger-full-access"`、`fullAuto: true`，并新增旧配置归一化测试。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/defaults.test.ts`

Expected: 默认 sandbox 仍是 `workspace-write` 或归一化函数不存在。

- [ ] **Step 3: 实现默认配置和归一化**

在 `src/shared/defaults.ts` 增加固定配置函数，并在 `src/main/ipc.ts` 的 `normalizeJob()` 中调用。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/defaults.test.ts`

Expected: PASS.

### Task 2: 中文 UI 和删除参数控件

**Files:**
- Modify: `src/renderer/App.tsx`
- Create: `tests/appSource.test.ts`

- [ ] **Step 1: 写失败测试**

新增源码级 UI 文案测试，断言关键中文按钮存在，英文按钮和参数控件文案不存在。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- tests/appSource.test.ts`

Expected: 仍包含 `Start Queue`、`Model`、`Profile`、`Sandbox`、`Full Auto`。

- [ ] **Step 3: 实现 UI 修改**

将 `App.tsx` 可见文案改为中文，删除模型、Profile、Sandbox、Full Auto 控件。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- tests/appSource.test.ts`

Expected: PASS.

### Task 3: 全量验证

**Files:**
- Build outputs: `dist/`, `dist-electron/`

- [ ] **Step 1: 运行全量测试**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: 构建**

Run: `npm run build`

Expected: exit code 0.
