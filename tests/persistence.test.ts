import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { QueueDefinition } from "../src/shared/types";
import {
  clearSystemCache,
  createRunArtifacts,
  loadQueue,
  pruneRunArtifacts,
  queueFilePath,
  saveQueue
} from "../src/main/persistence";

function createQueue(instruction: string): QueueDefinition {
  return {
    id: "default-queue",
    name: "默认队列",
    jobs: [
      {
        id: "job-1",
        name: "任务 1",
        cwd: "/tmp/project",
        instruction,
        planFiles: [],
        codexOptions: {
          sandbox: "workspace-write",
          fullAuto: true,
          addDirs: []
        },
        policy: {
          onFailure: "stop"
        },
        status: "idle"
      }
    ],
    status: "idle",
    updatedAt: new Date().toISOString(),
    selectedJobId: "job-1"
  };
}

test("loadQueue recovers queue files with trailing garbage", async () => {
  const appDataDir = await mkdtemp(join(tmpdir(), "persistence-load-test-"));
  const filePath = queueFilePath(appDataDir, "default-queue");
  const content = `${JSON.stringify(createQueue("执行任务"), null, 2)}}`;

  await mkdir(join(appDataDir, "queues"), { recursive: true });
  await writeFile(filePath, content, "utf8");

  const loaded = await loadQueue(appDataDir, "default-queue");

  expect(loaded?.jobs[0]?.instruction).toBe("执行任务");
});

test("saveQueue keeps queue files valid under concurrent writes", async () => {
  const appDataDir = await mkdtemp(join(tmpdir(), "persistence-save-test-"));

  for (let round = 0; round < 25; round += 1) {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        saveQueue(appDataDir, createQueue(`任务内容 ${round}-${index} ${"x".repeat(4000 + index)}`))
      )
    );

    const content = await readFile(queueFilePath(appDataDir, "default-queue"), "utf8");

    expect(() => JSON.parse(content)).not.toThrow();
  }
});

test("pruneRunArtifacts removes older runs per job", async () => {
  const appDataDir = await mkdtemp(join(tmpdir(), "persistence-runs-test-"));

  await createRunArtifacts(appDataDir, "queue-1", "job-1", "2026-04-23T00-00-00.000Z");
  await createRunArtifacts(appDataDir, "queue-1", "job-1", "2026-04-23T00-00-01.000Z");
  await createRunArtifacts(appDataDir, "queue-1", "job-1", "2026-04-23T00-00-02.000Z");
  await createRunArtifacts(appDataDir, "queue-1", "job-2", "2026-04-23T00-00-00.000Z");

  const removed = await pruneRunArtifacts(appDataDir, { maxRunsPerJob: 2 });
  const jobOneRuns = await readdir(join(appDataDir, "runs", "queue-1", "job-1"));
  const jobTwoRuns = await readdir(join(appDataDir, "runs", "queue-1", "job-2"));

  expect(removed).toBe(1);
  expect(jobOneRuns.sort()).toEqual([
    "2026-04-23T00-00-01.000Z",
    "2026-04-23T00-00-02.000Z"
  ]);
  expect(jobTwoRuns).toEqual(["2026-04-23T00-00-00.000Z"]);
});

test("pruneRunArtifacts removes stale files from retained runs", async () => {
  const appDataDir = await mkdtemp(join(tmpdir(), "persistence-stale-files-test-"));
  const artifacts = await createRunArtifacts(appDataDir, "queue-1", "job-1", "2026-04-23T00-00-00.000Z");

  await writeFile(join(artifacts.runDir, "prompt.txt"), "legacy prompt", "utf8");
  await writeFile(join(artifacts.runDir, "events.jsonl"), "", "utf8");
  await writeFile(join(artifacts.runDir, "last-message.txt"), "", "utf8");
  await writeFile(`${artifacts.stdoutPath}.pipe`, "", "utf8");
  await writeFile(`${artifacts.stderrPath}.pipe`, "", "utf8");

  const removed = await pruneRunArtifacts(appDataDir, { maxRunsPerJob: 2 });
  const files = await readdir(artifacts.runDir);

  expect(removed).toBe(5);
  expect(files).not.toContain("events.jsonl");
  expect(files).not.toContain("last-message.txt");
  expect(files).not.toContain("prompt.txt");
  expect(files).not.toContain("stdout.log.pipe");
  expect(files).not.toContain("stderr.log.pipe");
});

test("clearSystemCache removes invalid run directories and expired history", async () => {
  const appDataDir = await mkdtemp(join(tmpdir(), "persistence-cache-cleanup-test-"));

  const retained = await createRunArtifacts(appDataDir, "queue-1", "job-1", "2026-04-23T00-00-02.000Z");
  await writeFile(retained.stdoutPath, "ok", "utf8");
  await writeFile(retained.stderrPath, "", "utf8");
  await writeFile(retained.metaPath, "{}", "utf8");

  await createRunArtifacts(appDataDir, "queue-1", "job-1", "2026-04-23T00-00-00.000Z");
  await createRunArtifacts(appDataDir, "queue-1", "job-1", "2026-04-23T00-00-01.000Z");
  await mkdir(join(appDataDir, "runs", "queue-1", "job-1", "broken-run"), { recursive: true });
  await writeFile(join(appDataDir, "runs", "queue-1", "job-1", "broken-run", "stdout.log"), "partial", "utf8");

  const result = await clearSystemCache(appDataDir, { maxRunsPerJob: 1 });
  const jobRuns = await readdir(join(appDataDir, "runs", "queue-1", "job-1"));

  expect(result.removedEntries).toBe(3);
  expect(jobRuns).toEqual(["2026-04-23T00-00-02.000Z"]);
});
