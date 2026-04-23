import { dialog, ipcMain, type BrowserWindow } from "electron";

import { CodexRunner } from "./codexRunner";
import { QueueEngine } from "./queueEngine";
import { clearSystemCache, loadQueue, listQueues, saveQueue } from "./persistence";
import {
  createDefaultQueueJob,
  normalizeCodexOptions,
  normalizeJobInstruction
} from "../shared/defaults";
import type { QueueDefinition, QueueJob } from "../shared/types";

const IPC_CHANNELS = {
  getState: "queue:get-state",
  save: "queue:save",
  start: "queue:start",
  stop: "queue:stop",
  clearSystemCache: "queue:clear-system-cache",
  pickPlanFiles: "dialog:pick-plan-files",
  pickDirectory: "dialog:pick-directory",
  queueState: "queue:state",
  runnerOutput: "runner:output"
} as const;

export async function registerIpcHandlers(
  window: BrowserWindow,
  appDataDir: string
): Promise<QueueDefinition> {
  for (const channel of Object.values(IPC_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }

  const runner = new CodexRunner({ appDataDir });
  let currentQueue = await loadInitialQueue(appDataDir);
  let engine = createEngine(currentQueue);

  function attachEngineListeners(nextEngine: QueueEngine): void {
    nextEngine.on("state", (state: QueueDefinition) => {
      currentQueue = state;
      void saveQueue(appDataDir, currentQueue);
      window.webContents.send(IPC_CHANNELS.queueState, currentQueue);
    });
  }

  function createEngine(queue: QueueDefinition): QueueEngine {
    const nextEngine = new QueueEngine(queue, {
      start(job) {
        return runner.start(queue.id, job, {
          onOutput(event) {
            window.webContents.send(IPC_CHANNELS.runnerOutput, event);
          }
        });
      }
    });

    attachEngineListeners(nextEngine);
    return nextEngine;
  }

  function replaceEngine(nextQueue: QueueDefinition): void {
    engine.removeAllListeners();
    currentQueue = normalizeQueue(nextQueue).queue;
    engine = createEngine(currentQueue);
  }

  ipcMain.handle(IPC_CHANNELS.getState, async () => currentQueue);

  ipcMain.handle(IPC_CHANNELS.save, async (_event, queue: QueueDefinition) => {
    if (currentQueue.status === "running") {
      throw new Error("Cannot save queue while it is running.");
    }

    replaceEngine(queue);
    await saveQueue(appDataDir, currentQueue);
    return currentQueue;
  });

  ipcMain.handle(IPC_CHANNELS.start, async () => engine.startQueue());

  ipcMain.handle(IPC_CHANNELS.stop, async () => engine.stopQueue());

  ipcMain.handle(IPC_CHANNELS.clearSystemCache, async () => {
    if (currentQueue.status === "running") {
      throw new Error("Cannot clear system cache while the queue is running.");
    }

    return clearSystemCache(appDataDir);
  });

  ipcMain.handle(IPC_CHANNELS.pickPlanFiles, async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "选择计划文件",
      properties: ["openFile", "multiSelections"]
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.pickDirectory, async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "选择工作目录",
      properties: ["openDirectory"]
    });

    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  return currentQueue;
}

function normalizeQueue(queue: QueueDefinition): { queue: QueueDefinition; changed: boolean } {
  let changed = false;
  const jobs = queue.jobs.map((job) => {
    const normalized = normalizeJob(job);
    changed ||= normalized.changed;
    return normalized.job;
  });
  const status = queue.status === "running" ? "idle" : queue.status;
  changed ||= status !== queue.status;

  return {
    queue: {
      ...queue,
      jobs,
      updatedAt: changed ? new Date().toISOString() : queue.updatedAt,
      status
    },
    changed
  };
}

function normalizeJob(job: QueueJob): { job: QueueJob; changed: boolean } {
  const instruction = normalizeJobInstruction(job.instruction);
  const codexOptions = normalizeCodexOptions(job.codexOptions);
  const status = job.status === "running" ? "interrupted" : job.status;
  const changed =
    instruction !== job.instruction ||
    status !== job.status ||
    job.codexOptions?.sandbox !== codexOptions.sandbox ||
    job.codexOptions?.fullAuto !== codexOptions.fullAuto ||
    job.codexOptions?.profile !== codexOptions.profile ||
    job.codexOptions?.skipGitRepoCheck !== codexOptions.skipGitRepoCheck ||
    !sameStringArray(job.codexOptions?.addDirs ?? [], codexOptions.addDirs);

  return {
    job: {
      ...job,
      instruction,
      planFiles: [...job.planFiles],
      codexOptions,
      status
    },
    changed
  };
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function loadInitialQueue(appDataDir: string): Promise<QueueDefinition> {
  const queueIds = await listQueues(appDataDir);

  if (queueIds[0]) {
    const loaded = await loadQueue(appDataDir, queueIds[0]);

    if (loaded) {
      const normalized = normalizeQueue(loaded);

      if (normalized.changed) {
        await saveQueue(appDataDir, normalized.queue);
      }

      return normalized.queue;
    }
  }

  const queue = createDefaultQueue();
  await saveQueue(appDataDir, queue);
  return queue;
}

function createDefaultQueue(): QueueDefinition {
  const firstJob = createDefaultJob(1);

  return {
    id: "default-queue",
    name: "默认队列",
    jobs: [firstJob],
    status: "idle",
    updatedAt: new Date().toISOString(),
    selectedJobId: firstJob.id
  };
}

function createDefaultJob(index: number): QueueJob {
  return createDefaultQueueJob({
    id: `job-${index}`,
    name: `任务 ${index}`
  });
}
