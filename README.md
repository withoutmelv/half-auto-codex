# Codex Queue Desktop

一个桌面版的 Codex 串行任务执行器。

它允许你预先配置一组需要依次执行的 Codex 任务；每个任务可以绑定一个或多个计划文件；只有当前一个任务执行完成并退出后，才会启动下一个任务。

## 功能

- 结构化配置队列任务，而不是手写整条 `codex exec` 命令
- 每个任务支持：
  - 工作目录 `cwd`
  - 主任务说明 `instruction`
  - 多个计划文件 `planFiles`
  - 常用 Codex 参数：`sandbox`、`profile`、`fullAuto`
- 严格串行执行
- 前一任务退出码为 `0` 时自动推进下一项
- 前一任务退出码非 `0` 时停止整个队列
- 支持 `Start Queue`、`Run Selected`、`Stop`、`Retry`、`Skip`
- 保存 stdout、stderr、退出码和元数据

## 技术栈

- Electron
- React
- TypeScript
- Vite
- Vitest

## 环境要求

- Node.js 20+
- 本机已安装 `codex` CLI
- `codex` 已完成登录并可在终端直接执行

可以先确认：

```bash
codex --help
codex exec --help
```

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

开发模式会同时启动：

- Vite renderer dev server
- Electron main/preload TypeScript watch
- Electron 桌面窗口

## 构建

```bash
npm run build
```

构建后会生成：

- `dist/`：renderer 产物
- `dist-electron/`：Electron main/preload 产物

## 校验

运行测试：

```bash
npm test
```

运行类型检查：

```bash
npm run typecheck
```

## 使用方式

### 1. 创建或编辑任务

每个任务包含：

- `name`：任务名
- `cwd`：Codex 执行目录
- `instruction`：主任务说明
- `planFiles`：一个或多个计划文件路径
- `codexOptions`
  - `sandbox`
  - `profile`
  - `fullAuto`

### 2. 保存队列

点击 `Save Queue` 会把当前队列保存到本地应用数据目录。

### 3. 启动执行

- `Start Queue`：从队列头开始串行执行
- `Run Selected`：只执行当前选中的任务

### 4. 队列行为

- 同一时刻只会有一个任务处于 `running`
- 当前任务完成前，不会启动后续任务
- 退出码 `0`：标记为 `succeeded`，继续下一项
- 非 `0`：标记为 `failed`，整个队列停止
- `Stop`：终止当前任务并停止队列
- `Retry`：从当前任务重新开始
- `Skip`：跳过当前失败任务

## Prompt 组装方式

执行时不会直接让用户输入整条 shell 命令。

应用会：

1. 读取任务说明 `instruction`
2. 校验所有 `planFiles` 路径是否可读取
3. 将任务说明和计划文件路径拼成一个简短的 `[PROMPT]` 参数
4. 打开新的 Terminal 窗口，在任务工作目录下通过包装脚本调用：

```bash
cd <cwd> && codex exec --full-auto --skip-git-repo-check '<instruction>计划文件：<plan-file>'
```

不会生成或通过 stdin 传递 `prompt.txt`；应用会通过 `run.sh` 包装 `codex exec`，以便记录 stdout、stderr、退出码和 PID，并保持严格串行执行。

运行历史会按队列和任务落盘；每个任务默认只保留最近 `20` 次运行产物，旧运行目录会自动清理。旧版遗留的 `prompt.txt`、`events.jsonl`、`last-message.txt` 和残留 `.pipe` 文件也会在清理时移除。

示例命令：

```bash
cd /Users/withoutmelv/work/half-auto-codex && codex exec --full-auto --skip-git-repo-check '当前已经实现好了 plans 文档，继续按照 superpowers 的流程执行下去，中途不要停止直到任务完成。计划文件：/Users/withoutmelv/work/half-auto-codex/docs/superpowers/plans/2026-04-23-codex-queue-desktop.md'
```

根据配置还会追加：

- `-p <profile>`
- `-s <sandbox>`
- `--full-auto`
- `--skip-git-repo-check`
- `--add-dir <dir>`

## 本地持久化

运行数据保存在 Electron 的 `app.getPath("userData")` 目录下。

目录结构大致如下：

```text
queues/
  <queue-id>.json
runs/
  <queue-id>/
    <job-id>/
      <run-id>/
        stdout.log
        stderr.log
        meta.json
```

## 关键文件

- `src/main/main.ts`：Electron 启动入口
- `src/main/ipc.ts`：IPC handler、文件选择、状态广播
- `src/main/queueEngine.ts`：串行队列状态机
- `src/main/codexRunner.ts`：`codex exec` 调用与日志落盘
- `src/main/prompt.ts`：计划文件读取与 prompt 组装
- `src/main/persistence.ts`：本地队列与运行产物存储
- `src/preload.ts`：暴露给 renderer 的安全 API
- `src/renderer/App.tsx`：三栏桌面 UI
- `src/renderer/styles.css`：严格遵循 `DESIGN.md` 的样式实现

## 当前限制

- 当前只支持单队列内串行执行
- 失败策略固定为失败即停
- 不支持并行任务
- 不自动恢复未完成中的任务
- 暂未实现任务模板、运行历史筛选和多队列切换

## 设计与规格

- 规格文档：`docs/superpowers/specs/2026-04-23-codex-queue-desktop-design.md`
- 实施计划：`docs/superpowers/plans/2026-04-23-codex-queue-desktop.md`
- 视觉规范：`DESIGN.md`
