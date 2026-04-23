import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CacheCleanupResult, QueueDefinition, RunArtifacts } from "../shared/types";

const queueWriteLocks = new Map<string, Promise<void>>();
const DEFAULT_MAX_RUNS_PER_JOB = 20;
const STALE_RUN_FILE_NAMES = [
  "prompt.txt",
  "events.jsonl",
  "last-message.txt",
  "stdout.log.pipe",
  "stderr.log.pipe"
] as const;

interface RunPruneOptions {
  maxRunsPerJob?: number;
}

interface CacheCleanupOptions extends RunPruneOptions {}

export function queueFilePath(appDataDir: string, queueId: string): string {
  return join(appDataDir, "queues", `${queueId}.json`);
}

export async function saveQueue(appDataDir: string, queue: QueueDefinition): Promise<string> {
  const filePath = queueFilePath(appDataDir, queue.id);
  const previousWrite = queueWriteLocks.get(filePath) ?? Promise.resolve();
  const nextWrite = previousWrite
    .catch(() => undefined)
    .then(async () => {
      await mkdir(join(appDataDir, "queues"), { recursive: true });
      await writeQueueFile(filePath, JSON.stringify(queue, null, 2));
    });

  queueWriteLocks.set(filePath, nextWrite);

  try {
    await nextWrite;
  } finally {
    if (queueWriteLocks.get(filePath) === nextWrite) {
      queueWriteLocks.delete(filePath);
    }
  }

  return filePath;
}

export async function loadQueue(
  appDataDir: string,
  queueId: string
): Promise<QueueDefinition | null> {
  const filePath = queueFilePath(appDataDir, queueId);

  try {
    const content = await readFile(filePath, "utf8");
    const parsed = parseQueue(content);

    if (parsed.recovered) {
      await saveQueue(appDataDir, parsed.queue);
    }

    return parsed.queue;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

export async function listQueues(appDataDir: string): Promise<string[]> {
  const dirPath = join(appDataDir, "queues");

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.replace(/\.json$/, ""))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function createRunArtifacts(
  appDataDir: string,
  queueId: string,
  jobId: string,
  runId = new Date().toISOString().replaceAll(":", "-")
): Promise<RunArtifacts> {
  const runDir = join(appDataDir, "runs", queueId, jobId, runId);
  await mkdir(runDir, { recursive: true });
  await pruneRunArtifacts(appDataDir, { maxRunsPerJob: DEFAULT_MAX_RUNS_PER_JOB });

  return {
    runId,
    runDir,
    stdoutPath: join(runDir, "stdout.log"),
    stderrPath: join(runDir, "stderr.log"),
    metaPath: join(runDir, "meta.json")
  };
}

export async function pruneRunArtifacts(
  appDataDir: string,
  options: RunPruneOptions = {}
): Promise<number> {
  const maxRunsPerJob = options.maxRunsPerJob ?? DEFAULT_MAX_RUNS_PER_JOB;

  if (!Number.isSafeInteger(maxRunsPerJob) || maxRunsPerJob < 1) {
    throw new Error("maxRunsPerJob must be a positive safe integer.");
  }

  const runsDir = join(appDataDir, "runs");
  let removed = 0;

  for (const queueEntry of await readDirs(runsDir)) {
    const queueDir = join(runsDir, queueEntry);

    for (const jobEntry of await readDirs(queueDir)) {
      const jobDir = join(queueDir, jobEntry);
      const runEntries = (await readDirs(jobDir)).sort();
      const staleEntries = runEntries.slice(0, Math.max(0, runEntries.length - maxRunsPerJob));

      for (const runEntry of runEntries) {
        removed += await pruneStaleRunFiles(join(jobDir, runEntry));
      }

      for (const staleEntry of staleEntries) {
        await rm(join(jobDir, staleEntry), { recursive: true, force: true });
        removed += 1;
      }
    }
  }

  return removed;
}

export async function clearSystemCache(
  appDataDir: string,
  options: CacheCleanupOptions = {}
): Promise<CacheCleanupResult> {
  const removedInvalidRuns = await removeInvalidRunDirectories(appDataDir);
  const removedExpiredEntries = await pruneRunArtifacts(appDataDir, options);

  return {
    removedEntries: removedInvalidRuns + removedExpiredEntries
  };
}

async function removeInvalidRunDirectories(appDataDir: string): Promise<number> {
  const runsDir = join(appDataDir, "runs");
  let removed = 0;

  for (const queueEntry of await readDirs(runsDir)) {
    const queueDir = join(runsDir, queueEntry);

    for (const jobEntry of await readDirs(queueDir)) {
      const jobDir = join(queueDir, jobEntry);

      for (const runEntry of await readDirs(jobDir)) {
        const runDir = join(jobDir, runEntry);

        if (await isValidRunDirectory(runDir)) {
          continue;
        }

        await rm(runDir, { recursive: true, force: true });
        removed += 1;
      }
    }
  }

  return removed;
}

async function isValidRunDirectory(runDir: string): Promise<boolean> {
  const requiredFiles = ["stdout.log", "stderr.log", "meta.json"];

  for (const fileName of requiredFiles) {
    try {
      await access(join(runDir, fileName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }

  return true;
}

async function pruneStaleRunFiles(runDir: string): Promise<number> {
  let removed = 0;

  for (const fileName of STALE_RUN_FILE_NAMES) {
    const filePath = join(runDir, fileName);

    try {
      await access(filePath);
      await rm(filePath, { force: true });
      removed += 1;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return removed;
}

async function readDirs(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeQueueFile(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await writeFile(tempPath, content, "utf8");
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function parseQueue(content: string): { queue: QueueDefinition; recovered: boolean } {
  try {
    return {
      queue: JSON.parse(content) as QueueDefinition,
      recovered: false
    };
  } catch (error) {
    const queue = recoverQueueWithTrailingGarbage(content, error);

    if (queue) {
      return {
        queue,
        recovered: true
      };
    }

    throw error;
  }
}

function recoverQueueWithTrailingGarbage(content: string, error: unknown): QueueDefinition | null {
  if (!(error instanceof SyntaxError)) {
    return null;
  }

  const match = error.message.match(/Unexpected non-whitespace character after JSON at position (\d+)/);

  if (!match?.[1]) {
    return null;
  }

  const validJsonEnd = Number.parseInt(match[1], 10);

  if (!Number.isSafeInteger(validJsonEnd) || validJsonEnd <= 0) {
    return null;
  }

  try {
    return JSON.parse(content.slice(0, validJsonEnd).trimEnd()) as QueueDefinition;
  } catch {
    return null;
  }
}
