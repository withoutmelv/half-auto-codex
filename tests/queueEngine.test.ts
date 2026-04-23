import type { QueueDefinition, QueueJob, RunningJobHandle } from "../src/shared/types";
import { QueueEngine } from "../src/main/queueEngine";

function createJob(id: string): QueueJob {
  return {
    id,
    name: `任务 ${id}`,
    cwd: "/tmp/project",
    instruction: `执行 ${id}`,
    planFiles: [],
    codexOptions: {
      sandbox: "workspace-write",
      addDirs: []
    },
    policy: {
      onFailure: "stop"
    },
    status: "idle"
  };
}

function createQueue(jobs: QueueJob[]): QueueDefinition {
  return {
    id: "queue_01",
    name: "默认队列",
    jobs,
    status: "idle",
    updatedAt: new Date().toISOString()
  };
}

test("QueueEngine runs one job at a time and advances on success", async () => {
  const starts: string[] = [];
  const queue = createQueue([createJob("job-1"), createJob("job-2")]);
  const engine = new QueueEngine(queue, {
    start(job): RunningJobHandle {
      starts.push(job.id);
      return {
        stop() {
          return Promise.resolve();
        },
        promise: Promise.resolve({
          exitCode: 0,
          signal: null,
          startedAt: "2026-04-23T10:00:00.000Z",
          endedAt: "2026-04-23T10:00:01.000Z",
          artifacts: {
            runId: `${job.id}-run`,
            runDir: `/tmp/${job.id}`,
            stdoutPath: `/tmp/${job.id}/stdout.log`,
            stderrPath: `/tmp/${job.id}/stderr.log`,
            metaPath: `/tmp/${job.id}/meta.json`
          }
        })
      };
    }
  });

  await engine.startQueue();

  expect(starts).toEqual(["job-1", "job-2"]);
  expect(engine.getState().jobs.map((job) => job.status)).toEqual([
    "succeeded",
    "succeeded"
  ]);
  expect(engine.getState().status).toBe("succeeded");
});

test("QueueEngine stops the queue after a failed job", async () => {
  const starts: string[] = [];
  const queue = createQueue([createJob("job-1"), createJob("job-2")]);
  const engine = new QueueEngine(queue, {
    start(job): RunningJobHandle {
      starts.push(job.id);
      return {
        stop() {
          return Promise.resolve();
        },
        promise: Promise.resolve({
          exitCode: job.id === "job-1" ? 1 : 0,
          signal: null,
          startedAt: "2026-04-23T10:00:00.000Z",
          endedAt: "2026-04-23T10:00:01.000Z",
          artifacts: {
            runId: `${job.id}-run`,
            runDir: `/tmp/${job.id}`,
            stdoutPath: `/tmp/${job.id}/stdout.log`,
            stderrPath: `/tmp/${job.id}/stderr.log`,
            metaPath: `/tmp/${job.id}/meta.json`
          }
        })
      };
    }
  });

  await engine.startQueue();

  expect(starts).toEqual(["job-1"]);
  expect(engine.getState().jobs[0]?.status).toBe("failed");
  expect(engine.getState().jobs[1]?.status).toBe("idle");
  expect(engine.getState().status).toBe("failed");
});

test("QueueEngine marks a job failed when the runner rejects", async () => {
  const queue = createQueue([createJob("job-1")]);
  const engine = new QueueEngine(queue, {
    start(): RunningJobHandle {
      return {
        stop() {
          return Promise.resolve();
        },
        promise: Promise.reject(new Error("spawn failed"))
      };
    }
  });

  await engine.startQueue();

  expect(engine.getState().jobs[0]?.status).toBe("failed");
  expect(engine.getState().jobs[0]?.exitCode).toBe(1);
  expect(engine.getState().status).toBe("failed");
});
