import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/renderer/App.tsx", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../src/preload.ts", import.meta.url), "utf8");
const sharedTypesSource = readFileSync(new URL("../src/shared/types.ts", import.meta.url), "utf8");
const ipcSource = readFileSync(new URL("../src/main/ipc.ts", import.meta.url), "utf8");
const queueEngineSource = readFileSync(new URL("../src/main/queueEngine.ts", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/renderer/styles.css", import.meta.url), "utf8");

function sourceBetween(start: string, end: string): string {
  const startIndex = appSource.indexOf(start);
  const endIndex = appSource.indexOf(end, startIndex);

  if (startIndex < 0 || endIndex < 0) {
    return "";
  }

  return appSource.slice(startIndex, endIndex);
}

test("App source contains the core Chinese UI copy", () => {
  expect(appSource).toContain("Codex 队列桌面版");
  expect(appSource).toContain("清理缓存");
  expect(appSource).toContain("启动队列");
  expect(appSource).toContain("停止队列");
  expect(appSource).toContain("添加任务");
  expect(appSource).toContain("上移任务");
  expect(appSource).toContain("下移任务");
  expect(appSource).toContain("删除任务");
  expect(appSource).toContain("浏览目录");
  expect(appSource).toContain("选择计划文件");
  expect(appSource).toContain("浅色");
  expect(appSource).toContain("深色");
});

test("App source removes English controls and execution parameter labels", () => {
  expect(appSource).not.toContain("Codex Queue Desktop");
  expect(appSource).not.toContain("Save Queue");
  expect(appSource).not.toContain("Start Queue");
  expect(appSource).not.toContain("Run Selected");
  expect(appSource).not.toContain("Stop");
  expect(appSource).not.toContain("Retry");
  expect(appSource).not.toContain("Skip");
  expect(appSource).not.toContain("Add Job");
  expect(appSource).not.toContain("Move Up");
  expect(appSource).not.toContain("Move Down");
  expect(appSource).not.toContain("Delete");
  expect(appSource).not.toContain("Browse");
  expect(appSource).not.toContain("Select Files");
  expect(appSource).not.toContain("Model");
  expect(appSource).not.toContain("Profile");
  expect(appSource).not.toContain("Sandbox");
  expect(appSource).not.toContain("Full Auto");
});

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

test("App source no longer renders the final-message panel", () => {
  expect(appSource).not.toContain("最后消息");
});

test("App source keeps only global actions in the top toolbar", () => {
  const toolbarSource = sourceBetween('<div className="toolbar-actions">', "</header>");

  expect(toolbarSource).toContain("清理缓存");
  expect(toolbarSource).toContain("启动队列");
  expect(toolbarSource).toContain("停止队列");
  expect(toolbarSource).toContain("theme-toggle");
  expect(toolbarSource).not.toContain("保存队列");
  expect(toolbarSource).not.toContain("运行所选任务");
  expect(toolbarSource).not.toContain("重试任务");
  expect(toolbarSource).not.toContain("跳过任务");
});

test("App source exposes system cache cleanup from the toolbar", () => {
  expect(appSource).toContain("clearingCache");
  expect(appSource).toContain("handleClearSystemCache");
  expect(appSource).toContain('typeof window.codexQueue.clearSystemCache !== "function"');
  expect(appSource).toContain("清理缓存接口未加载，请重启应用后再试。");
  expect(appSource).toContain("window.codexQueue.clearSystemCache");
  expect(preloadSource).toContain("queue:clear-system-cache");
  expect(sharedTypesSource).toContain("clearSystemCache");
  expect(ipcSource).toContain("clearSystemCache(appDataDir)");
});

test("App source removes selected-task execution controls from the editor header", () => {
  const editorActionsSource = sourceBetween('<div className="editor-actions">', '<div className="form-grid">');

  expect(editorActionsSource).not.toContain("运行所选任务");
  expect(editorActionsSource).not.toContain("重试任务");
  expect(editorActionsSource).not.toContain("跳过任务");
  expect(editorActionsSource).toContain("上移任务");
  expect(editorActionsSource).toContain("下移任务");
  expect(editorActionsSource).toContain("删除任务");
});

test("App source renders the queue as a task rail", () => {
  expect(appSource).toContain("job-step-marker");
  expect(appSource).toContain("job-item-content");
  expect(appSource).toContain("formatDirectoryLabel(job.cwd)");
  expect(appSource).toContain("queue-group");
});

test("App source auto-saves local queue edits", () => {
  expect(appSource).toContain("hasLocalChanges");
  expect(appSource).toContain("setHasLocalChanges(true)");
  expect(appSource).toContain("window.setTimeout");
  expect(appSource).toContain("saveQueueNow");
  expect(appSource).not.toContain("保存队列");
});

test("Renderer exposes a light and dark theme switch", () => {
  expect(appSource).toContain("type ThemeMode");
  expect(appSource).toContain("theme-toggle");
  expect(appSource).toContain('data-theme={theme}');
  expect(stylesSource).toContain('.app-shell[data-theme="dark"]');
});

test("Selected-task execution IPC methods are no longer exposed", () => {
  expect(appSource).not.toContain("runSelectedJob");
  expect(appSource).not.toContain("retryFromJob");
  expect(appSource).not.toContain("skipJob");
  expect(preloadSource).not.toContain("queue:run-selected");
  expect(preloadSource).not.toContain("queue:retry");
  expect(preloadSource).not.toContain("queue:skip");
  expect(sharedTypesSource).not.toContain("runSelectedJob");
  expect(sharedTypesSource).not.toContain("retryFromJob");
  expect(sharedTypesSource).not.toContain("skipJob");
  expect(ipcSource).not.toContain("queue:run-selected");
  expect(ipcSource).not.toContain("queue:retry");
  expect(ipcSource).not.toContain("queue:skip");
  expect(queueEngineSource).not.toContain("runSelectedJob");
  expect(queueEngineSource).not.toContain("retryFromJob");
  expect(queueEngineSource).not.toContain("skipJob");
});
