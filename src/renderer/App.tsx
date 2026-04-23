import { useEffect, useMemo, useRef, useState } from "react";

import { createDefaultQueueJob } from "../shared/defaults";
import type { QueueDefinition, QueueJob, RunnerOutputEvent } from "../shared/types";

const EMPTY_LOGS: Record<string, RunnerOutputEvent[]> = {};
const THEME_STORAGE_KEY = "codex-queue-theme";

type ThemeMode = "light" | "dark";

function readInitialTheme(): ThemeMode {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "dark" ? "dark" : "light";
}

function cloneQueue(queue: QueueDefinition): QueueDefinition {
  return {
    ...queue,
    jobs: queue.jobs.map((job) => ({
      ...job,
      planFiles: [...job.planFiles],
      codexOptions: {
        ...job.codexOptions,
        addDirs: [...job.codexOptions.addDirs]
      }
    }))
  };
}

function createLocalJob(index: number): QueueJob {
  return createDefaultQueueJob({
    id: `job-${Date.now()}-${index}`,
    name: `任务 ${index}`
  });
}

function formatDirectoryLabel(cwd: string): string {
  if (!cwd) {
    return "未设置目录";
  }

  const parts = cwd.split("/").filter(Boolean);
  return parts.slice(-2).join("/") || cwd;
}

function statusTone(status: QueueJob["status"] | QueueDefinition["status"]): string {
  switch (status) {
    case "succeeded":
      return "success";
    case "failed":
      return "danger";
    case "running":
      return "running";
    case "stopped":
    case "interrupted":
    case "skipped":
      return "stopped";
    default:
      return "default";
  }
}

function statusLabel(status: QueueJob["status"] | QueueDefinition["status"]): string {
  switch (status) {
    case "idle":
      return "空闲";
    case "queued":
      return "已排队";
    case "running":
      return "执行中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    case "stopped":
      return "已停止";
    case "skipped":
      return "已跳过";
    case "interrupted":
      return "已中断";
    default:
      return status;
  }
}

function busyActionLabel(action: string): string {
  switch (action) {
    case "start":
      return "启动队列";
    case "stop":
      return "停止队列";
    default:
      return "处理中";
  }
}

function jobGroupKey(status: QueueJob["status"]): "attention" | "pending" | "done" {
  switch (status) {
    case "failed":
    case "running":
    case "stopped":
    case "interrupted":
      return "attention";
    case "succeeded":
    case "skipped":
      return "done";
    default:
      return "pending";
  }
}

function jobGroupLabel(group: "attention" | "pending" | "done"): string {
  switch (group) {
    case "attention":
      return "需要关注";
    case "done":
      return "已完成";
    default:
      return "待执行";
  }
}

function logKindLabel(kind: RunnerOutputEvent["kind"]): string {
  switch (kind) {
    case "stdout":
      return "标准输出";
    case "stderr":
      return "标准错误";
    case "status":
      return "状态";
    default:
      return kind;
  }
}

export default function App() {
  const [queue, setQueue] = useState<QueueDefinition | null>(null);
  const [logs, setLogs] = useState<Record<string, RunnerOutputEvent[]>>(EMPTY_LOGS);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [busyAction, setBusyAction] = useState<string>("");
  const [theme, setTheme] = useState<ThemeMode>(() => readInitialTheme());
  const localRevisionRef = useRef(0);
  const saveRequestRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    window.codexQueue
      .getState()
      .then((state) => {
        if (mounted) {
          acceptQueueState(state);
        }
      })
      .catch((reason: unknown) => {
        if (mounted) {
          setError(String(reason));
        }
      });

    const offState = window.codexQueue.onQueueState((state) => {
      if (mounted) {
        acceptQueueState(state);
      }
    });

    const offLog = window.codexQueue.onRunnerOutput((event) => {
      if (!mounted) {
        return;
      }

      setLogs((current) => ({
        ...current,
        [event.jobId]: [...(current[event.jobId] ?? []), event]
      }));
    });

    return () => {
      mounted = false;
      offState();
      offLog();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const selectedJob = useMemo(() => {
    if (!queue) {
      return null;
    }

    const selectedId = queue.selectedJobId ?? queue.jobs[0]?.id;
    return queue.jobs.find((job) => job.id === selectedId) ?? queue.jobs[0] ?? null;
  }, [queue]);

  const groupedJobs = useMemo(() => {
    if (!queue) {
      return [];
    }

    const order: Array<"attention" | "pending" | "done"> = ["attention", "pending", "done"];
    return order
      .map((group) => ({
        group,
        jobs: queue.jobs.filter((job) => jobGroupKey(job.status) === group)
      }))
      .filter((entry) => entry.jobs.length > 0);
  }, [queue]);

  const selectedLogs = selectedJob ? logs[selectedJob.id] ?? [] : [];
  const isRunning = queue?.status === "running";

  useEffect(() => {
    if (!queue || !hasLocalChanges || isRunning) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveQueueNow(queue);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [hasLocalChanges, isRunning, queue]);

  function acceptQueueState(state: QueueDefinition): void {
    localRevisionRef.current += 1;
    setQueue(state);
    setHasLocalChanges(false);
  }

  function mutateQueue(mutator: (draft: QueueDefinition) => void): void {
    if (!queue) {
      return;
    }

    const nextQueue = cloneQueue(queue);
    mutator(nextQueue);
    nextQueue.updatedAt = new Date().toISOString();
    localRevisionRef.current += 1;
    setQueue(nextQueue);
    setHasLocalChanges(true);
  }

  async function saveQueueNow(queueToSave: QueueDefinition): Promise<QueueDefinition | null> {
    const revision = localRevisionRef.current;
    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const saved = await window.codexQueue.saveQueue(queueToSave);

      if (saveRequestRef.current !== requestId || localRevisionRef.current !== revision) {
        return null;
      }

      acceptQueueState(saved);
      return saved;
    } catch (reason) {
      setError(String(reason));
      return null;
    } finally {
      if (saveRequestRef.current === requestId) {
        setSaving(false);
      }
    }
  }

  async function runAction(action: string, effect: () => Promise<QueueDefinition>): Promise<void> {
    setBusyAction(action);
    setError("");
    setNotice("");

    try {
      const state = await effect();
      acceptQueueState(state);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusyAction("");
    }
  }

  async function handleStartQueue(): Promise<void> {
    if (!queue) {
      return;
    }

    const saved = hasLocalChanges ? await saveQueueNow(queue) : queue;

    if (!saved) {
      return;
    }

    await runAction("start", () => window.codexQueue.startQueue());
  }

  async function handleClearSystemCache(): Promise<void> {
    if (typeof window.codexQueue.clearSystemCache !== "function") {
      setError("清理缓存接口未加载，请重启应用后再试。");
      return;
    }

    setClearingCache(true);
    setError("");
    setNotice("");

    try {
      const result = await window.codexQueue.clearSystemCache();
      setNotice(`已清理 ${result.removedEntries} 项缓存数据`);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setClearingCache(false);
    }
  }

  async function handlePickPlanFiles(): Promise<void> {
    if (!selectedJob) {
      return;
    }

    const picked = await window.codexQueue.pickPlanFiles();

    if (picked.length === 0) {
      return;
    }

    mutateQueue((draft) => {
      const target = draft.jobs.find((job) => job.id === selectedJob.id);

      if (target) {
        target.planFiles = picked;
      }
    });
  }

  async function handlePickDirectory(): Promise<void> {
    if (!selectedJob) {
      return;
    }

    const picked = await window.codexQueue.pickDirectory();

    if (!picked) {
      return;
    }

    mutateQueue((draft) => {
      const target = draft.jobs.find((job) => job.id === selectedJob.id);

      if (target) {
        target.cwd = picked;
      }
    });
  }

  if (!queue || !selectedJob) {
    return (
      <div className="app-shell" data-theme={theme}>
        <div className="toolbar">
          <div>
            <p className="eyebrow">Codex 队列桌面版</p>
            <h1>正在加载队列…</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <div className="viewport-warning">当前窗口过窄，请放大到至少 1200px。</div>
      <header className="toolbar">
        <div>
          <p className="eyebrow">Codex 队列桌面版</p>
          <h1>{queue.name}</h1>
        </div>
        <div className="toolbar-actions">
          <div className="theme-toggle" role="group" aria-label="主题切换">
            <button
              className={`theme-option ${theme === "light" ? "active" : ""}`}
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              浅色
            </button>
            <button
              className={`theme-option ${theme === "dark" ? "active" : ""}`}
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              深色
            </button>
          </div>
          <button
            className="button secondary"
            type="button"
            disabled={isRunning || clearingCache}
            onClick={() => void handleClearSystemCache()}
          >
            {clearingCache ? "清理中" : "清理缓存"}
          </button>
          <button
            className={isRunning ? "button danger" : "button primary"}
            disabled={!isRunning && (saving || clearingCache)}
            onClick={() =>
              isRunning
                ? void runAction("stop", () => window.codexQueue.stopQueue())
                : void handleStartQueue()
            }
          >
            {isRunning ? "停止队列" : "启动队列"}
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="notice-banner">{notice}</div> : null}

      <main className="workspace">
        <section className="panel queue-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">队列</p>
              <h2>任务列表</h2>
            </div>
            <button
              className="button secondary"
              disabled={isRunning}
              onClick={() =>
                mutateQueue((draft) => {
                  const nextJob = createLocalJob(draft.jobs.length + 1);
                  draft.jobs.push(nextJob);
                  draft.selectedJobId = nextJob.id;
                })
              }
            >
              添加任务
            </button>
          </div>

          <div className="queue-summary">
            <div className="summary-row">
              <span>状态</span>
              <span className={`status-badge ${statusTone(queue.status)}`}>{statusLabel(queue.status)}</span>
            </div>
            <div className="summary-row">
              <span>最近更新</span>
              <span>{new Date(queue.updatedAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="job-list">
            {groupedJobs.map(({ group, jobs }) => (
              <section key={group} className="queue-group">
                <p className="queue-group-title">{jobGroupLabel(group)}</p>
                {jobs.map((job) => {
                  const index = queue.jobs.findIndex((item) => item.id === job.id);

                  return (
                    <button
                      key={job.id}
                      className={`job-item ${statusTone(job.status)} ${job.id === selectedJob.id ? "selected" : ""}`}
                      onClick={() =>
                        mutateQueue((draft) => {
                          draft.selectedJobId = job.id;
                        })
                      }
                    >
                      <span className="job-step-marker">{index + 1}</span>
                      <div className="job-item-content">
                        <div className="job-item-top">
                          <strong className="job-item-title">{job.name || `任务 ${index + 1}`}</strong>
                          <span className={`status-badge ${statusTone(job.status)}`}>{statusLabel(job.status)}</span>
                        </div>
                        <div className="job-item-meta">
                          <span>{job.planFiles.length} 个计划文件</span>
                          <span className="job-item-detail">{formatDirectoryLabel(job.cwd)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </section>
            ))}
          </div>
        </section>

        <section className="panel editor-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">编辑</p>
              <h2>任务配置</h2>
            </div>
            <div className="editor-actions">
              <div className="inline-actions task-edit-actions">
                <button
                  className="button secondary"
                  disabled={isRunning}
                  onClick={() =>
                    mutateQueue((draft) => {
                      const index = draft.jobs.findIndex((job) => job.id === selectedJob.id);

                      if (index > 0) {
                        const current = draft.jobs[index];
                        const prev = draft.jobs[index - 1];

                        if (current && prev) {
                          draft.jobs[index - 1] = current;
                          draft.jobs[index] = prev;
                        }
                      }
                    })
                  }
                >
                  上移任务
                </button>
                <button
                  className="button secondary"
                  disabled={isRunning}
                  onClick={() =>
                    mutateQueue((draft) => {
                      const index = draft.jobs.findIndex((job) => job.id === selectedJob.id);

                      if (index >= 0 && index < draft.jobs.length - 1) {
                        const current = draft.jobs[index];
                        const next = draft.jobs[index + 1];

                        if (current && next) {
                          draft.jobs[index + 1] = current;
                          draft.jobs[index] = next;
                        }
                      }
                    })
                  }
                >
                  下移任务
                </button>
                <button
                  className="button danger"
                  disabled={isRunning || queue.jobs.length === 1}
                  onClick={() =>
                    mutateQueue((draft) => {
                      draft.jobs = draft.jobs.filter((job) => job.id !== selectedJob.id);
                      draft.selectedJobId = draft.jobs[0]?.id;
                    })
                  }
                >
                  删除任务
                </button>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>任务名</span>
              <input
                value={selectedJob.name}
                onChange={(event) =>
                  mutateQueue((draft) => {
                    const target = draft.jobs.find((job) => job.id === selectedJob.id);
                    if (target) {
                      target.name = event.target.value;
                    }
                  })
                }
              />
            </label>

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
          </div>
        </section>

        <section className="panel log-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">执行</p>
              <h2>日志与结果</h2>
            </div>
            <div className="log-meta">
              <span className={`status-badge ${statusTone(selectedJob.status)}`}>{statusLabel(selectedJob.status)}</span>
              <span>{busyAction ? `正在${busyActionLabel(busyAction)}` : "空闲"}</span>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-card">
              <span className="detail-label">退出码</span>
              <strong>{selectedJob.exitCode ?? "-"}</strong>
            </div>
            <div className="detail-card">
              <span className="detail-label">开始时间</span>
              <strong>{selectedJob.startedAt ? new Date(selectedJob.startedAt).toLocaleTimeString() : "-"}</strong>
            </div>
            <div className="detail-card">
              <span className="detail-label">结束时间</span>
              <strong>{selectedJob.endedAt ? new Date(selectedJob.endedAt).toLocaleTimeString() : "-"}</strong>
            </div>
          </div>

          <div className="result-block">
            <p className="eyebrow">实时日志</p>
            <div className="log-stream">
              {selectedLogs.length === 0 ? (
                <div className="log-line muted">尚无日志输出</div>
              ) : (
                selectedLogs.map((event, index) => (
                  <div key={`${event.timestamp}-${index}`} className={`log-line ${event.kind}`}>
                    <span className="log-prefix">[{logKindLabel(event.kind)}]</span> {event.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
