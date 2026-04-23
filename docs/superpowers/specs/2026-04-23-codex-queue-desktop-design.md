# Codex Queue Desktop 设计规格

- 日期：2026-04-23
- 状态：Draft
- 目标：构建一个桌面版 Codex 任务执行器，允许用户预先配置串行执行的任务队列；每个任务可附带一个或多个计划文件；仅当前一个任务完成并发出完成信号后，才开始下一个任务。

## 1. 问题定义

当前使用 Codex 执行多步任务时，用户需要手动组织计划文件、拼装 prompt、逐条运行命令并观察前一个任务是否结束。这个过程重复、容易出错，而且难以保留完整的运行日志和历史记录。

需要一个桌面工具来：

1. 以结构化方式配置 Codex 任务队列，而不是手写整条命令。
2. 为每个任务绑定一个或多个计划文件。
3. 严格串行执行队列，前一个任务退出后才能触发下一个。
4. 保存运行日志、退出码和执行元数据。
5. 在失败时停止队列，保留现场供用户检查、重试或跳过。

## 2. 成功标准

首版满足以下行为即视为成功：

1. 用户可以创建、保存、加载任务队列。
2. 每个任务支持配置 `cwd`、任务说明、计划文件列表和 Codex 运行参数。
3. 应用通过 `codex exec <PROMPT>` 启动 Codex，并在命令行参数中提交组装后的 prompt。
4. 队列一次只运行一个任务；当前任务退出码为 `0` 时自动推进下一项。
5. 当前任务退出码非 `0` 时，当前任务标记为失败，整个队列停止。
6. 用户可以查看当前运行日志和历史结果，并对失败项执行重试或跳过。

## 3. 非目标

以下内容不纳入首版范围：

1. 并行执行多个任务或多个队列。
2. 复杂工作流分支、条件跳转、依赖图调度。
3. 远程执行器、分布式 worker、云同步。
4. 任务成功/失败后的 Webhook、插件系统或自动后置动作。
5. 自动恢复中断中的任务执行。

## 4. 总体方案

采用 `Electron` 构建桌面应用，拆分为以下模块：

### 4.1 Main 进程

- 管理窗口生命周期。
- 作为唯一允许启动/终止 `codex` 子进程的层。
- 持有队列引擎和运行时状态。
- 负责本地文件读写、日志落盘、子进程事件转发。

### 4.2 Preload

- 暴露受控 IPC API 给渲染层。
- 不暴露任意命令执行能力。
- 仅提供队列管理、文件选择、运行控制、日志订阅等接口。

### 4.3 Renderer

- 负责配置任务、显示队列、展示日志和状态。
- 不直接接触 Node 子进程细节。
- 通过状态流订阅当前任务进度与历史运行结果。

### 4.4 Queue Engine

- 维护任务状态机、队列顺序和串行锁。
- 保证任意时刻只有一个任务处于 `running`。
- 根据退出码决定推进、停止、重试、跳过。

### 4.5 Codex Runner

- 将结构化任务转换为一次 `codex exec` 调用。
- 校验计划文件路径，将任务说明和路径引用拼成 `codex exec` 的 `[PROMPT]` 参数。
- 收集 stdout、stderr、退出码和执行元数据。

## 5. 任务队列模型

每个任务项包含以下字段：

```json
{
  "id": "job_01",
  "name": "实现设置页",
  "cwd": "/path/to/repo",
  "instruction": "按照计划文件完成设置页实现",
  "planFiles": [
    "/path/to/spec.md",
    "/path/to/plan.md"
  ],
  "codexOptions": {
    "sandbox": "workspace-write",
    "profile": "default",
    "fullAuto": true,
    "addDirs": []
  },
  "policy": {
    "onFailure": "stop"
  },
  "status": "idle"
}
```

### 5.1 字段说明

- `id`：任务唯一标识。
- `name`：界面展示名称。
- `cwd`：Codex 工作目录。
- `instruction`：面向 Codex 的主任务说明。
- `planFiles[]`：计划文件路径数组，执行时按顺序校验并拼入 prompt 参数，由 Codex 自行读取。
- `codexOptions`：与 `codex exec` 能力对齐的参数集合，首版支持：
  - `sandbox`
  - `profile`
  - `fullAuto`
  - `addDirs`
  - `skipGitRepoCheck`
- `policy.onFailure`：首版固定默认值 `stop`，后续可扩展。
- `status`：`idle` / `queued` / `running` / `succeeded` / `failed` / `stopped` / `skipped` / `interrupted`。

## 6. Prompt 组装协议

执行前，Runner 会从任务配置生成标准 prompt 文本：

1. 写入用户提供的主任务说明 `instruction`。
2. 依次附加每个计划文件路径，不内嵌文件全文。
3. 将最终 prompt 作为 `codex exec` 的 `[PROMPT]` 参数。
4. 打开新的 Terminal 窗口，先 `cd` 到任务工作目录，再通过包装脚本执行 `codex exec`。

推荐模板：

```text
{instruction}计划文件：{path1} 计划文件：{path2}
```

该设计让队列项保持结构化，避免要求用户直接编辑脆弱的 shell 命令。

## 7. Codex 调用约定

默认在新的 Terminal 窗口中使用非交互执行模式：

```bash
cd <cwd> && codex exec --full-auto --skip-git-repo-check '<instruction>计划文件：<plan-file>'
```

根据任务配置按需追加：

- `-s <sandbox>`
- `-p <profile>`
- `--full-auto`
- `--skip-git-repo-check`
- `--add-dir <dir>`

### 7.1 输入输出约定

- `[PROMPT]` 参数：组装后的 prompt。
- stdout：普通文本输出。
- stderr：错误输出。
- 退出码 `0`：视为完成成功。
- 非 `0`：视为任务失败。

## 8. 串行执行状态机

队列引擎遵循以下状态转移：

1. `idle -> queued`：用户保存或启动队列后进入待执行状态。
2. `queued -> running`：当调度器空闲时启动该任务。
3. `running -> succeeded`：子进程退出码为 `0`。
4. `running -> failed`：子进程退出码非 `0`。
5. `running -> stopped`：用户主动停止当前任务。
6. `failed -> skipped`：用户确认跳过失败项。
7. `running -> interrupted`：应用异常退出或重启后发现任务未自然结束。

### 8.1 调度规则

- 任意时刻只允许一个 `running`。
- 当前任务未结束前，不启动后续任务。
- 成功：自动推进下一条 `queued` 任务。
- 失败：停止整个队列。
- 跳过：当前失败项标记为 `skipped`，随后手动推进下一条。
- 重试：将目标项重置为 `queued`，从该项继续。

## 9. 用户交互与界面结构

桌面界面分为三栏：

### 9.1 队列列表

- 显示任务顺序、状态、名称、计划文件数量。
- 支持新增、删除、排序、复制任务。

### 9.2 任务编辑区

- 编辑 `name`、`cwd`、`instruction`、`planFiles`。
- 配置 `sandbox`、`profile`、`fullAuto`、`addDirs`。
- 提供计划文件选择器和基础校验反馈。

### 9.3 运行与日志区

- 展示当前队列状态与当前任务名。
- 展示实时 stdout/stderr。
- 展示退出码、开始/结束时间。
- 提供 `Start Queue`、`Run Selected`、`Stop`、`Retry`、`Skip`、`Save Queue`。

## 10. 日志与产物落盘

建议本地目录结构：

```text
app-data/
  queues/
    <queue-id>.json
  runs/
    <queue-id>/
      <job-id>/
        stdout.log
        stderr.log
        meta.json
```

### 10.1 设计原则

- 队列配置与运行产物分离。
- 历史运行按队列和任务分目录保存。
- 每个任务默认保留最近 `20` 次运行目录，超过上限的旧目录自动删除。
- 清理运行目录时同步移除旧版 `prompt.txt`、`events.jsonl`、`last-message.txt` 和残留 `.pipe` 临时文件。
- 即使输出中混入不可解析内容，原始日志也必须保留。

## 11. 异常处理

### 11.1 启动前校验

- `codex` 不存在：禁止启动队列并给出安装提示。
- `cwd` 不存在或不可读：任务直接失败，不启动子进程。
- 任一计划文件不存在或不可读：任务直接失败，不启动子进程。

### 11.2 运行时异常

- stdout 中混入额外内容：按普通输出处理，不影响任务本身。
- 用户停止：先发送 `SIGTERM`，超时后发送 `SIGKILL`；任务标记为 `stopped`。
- 应用重启：上次仍在 `running` 的任务标记为 `interrupted`。

## 12. 持久化与恢复

- 恢复队列定义、最近选中项和历史运行记录。
- 不自动恢复或重跑中断任务。
- 用户可以手动对 `failed`、`stopped`、`interrupted` 执行 `Retry`。

## 13. 测试策略

### 13.1 单元测试

- 队列调度器状态迁移。
- 串行锁行为。
- 重试、跳过、停止逻辑。
- Prompt 参数组装顺序和路径注入格式。

### 13.2 集成测试

- 用 mock/stub `codex` 进程模拟成功、失败、长时间运行场景。
- 验证退出码处理、日志落盘和队列推进。

### 13.3 UI 测试

- 创建任务、添加计划文件、保存队列。
- 启动队列、停止任务、重试失败项。
- 日志区域渲染状态变化。

### 13.4 手工验收

- 单任务成功串行完成。
- 多任务串行推进。
- 第二个任务失败时队列停止。
- 用户点击停止后不再继续后续任务。

## 14. 实施顺序建议

1. 初始化 Electron 工程骨架。
2. 编写 `DESIGN.md` 并建立基础 UI token。
3. 实现队列数据模型与本地持久化。
4. 实现 Queue Engine 与状态机。
5. 实现 Codex Runner 与日志落盘。
6. 接入渲染层 UI。
7. 补齐单元测试与集成测试。

## 15. 后续可扩展方向

- 任务模板与预设命令。
- 失败策略可配置。
- 多队列管理。
- 运行历史筛选与全文检索。
- 支持 resume/fork 等更高级 Codex 能力。
