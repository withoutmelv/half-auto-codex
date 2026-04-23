# 中文固定全自动 UI 设计规格

- 日期：2026-04-23
- 状态：Approved
- 范围：仅应用 UI，不修改 README 或历史规格文档中的英文表述。

## 目标

将 Codex Queue Desktop 的可见应用界面统一为中文，并把任务执行参数固定为全自动高权限模式，减少编辑区配置项。

## 需求

1. 应用界面中的英文按钮、标签、提示和状态说明改为中文。
2. 编辑区删除 `Model`、`Profile`、`Sandbox`、`Full Auto` 控件。
3. 新建任务默认 `sandbox: "danger-full-access"`。
4. 新建任务默认 `fullAuto: true`。
5. 加载旧队列时迁移任务配置：
   - `sandbox` 统一为 `"danger-full-access"`。
   - `fullAuto` 统一为 `true`。
   - `model` 和 `profile` 从任务配置中移除。
6. Codex Runner 仍按固定配置执行：
   - 因为 `fullAuto: true`，命令传入 `--full-auto`。
   - 不再依赖 UI 配置 `model`、`profile` 或其他 sandbox 选项。

## 非目标

- 不修改 CSS 视觉参数。
- 不修改 README。
- 不修改历史计划/规格文档。
- 不新增可配置开关。

## 验收

- 新任务默认配置为 `danger-full-access` + `fullAuto: true`。
- 旧任务加载后自动变成固定全自动配置。
- UI 不再显示 `Model`、`Profile`、`Sandbox`、`Full Auto`。
- UI 操作按钮和可见标签改为中文。
- 全量测试、类型检查、构建通过。
