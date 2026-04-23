import { EventEmitter } from "node:events";

import type { JobRunResult, QueueDefinition, QueueJob, QueueRunner } from "../shared/types";

function cloneQueue(queue: QueueDefinition): QueueDefinition {
  return {
    ...queue,
    jobs: queue.jobs.map((job) => ({ ...job }))
  };
}

export class QueueEngine extends EventEmitter {
  private queue: QueueDefinition;
  private readonly runner: QueueRunner;
  private activeStop?: () => Promise<void> | void;
  private stopRequested = false;

  constructor(queue: QueueDefinition, runner: QueueRunner) {
    super();
    this.queue = cloneQueue(queue);
    this.runner = runner;
  }

  getState(): QueueDefinition {
    return cloneQueue(this.queue);
  }

  async startQueue(): Promise<QueueDefinition> {
    return this.runJobs(0);
  }

  async stopQueue(): Promise<QueueDefinition> {
    this.stopRequested = true;
    this.queue.status = "stopped";
    this.touch();

    if (this.activeStop) {
      await this.activeStop();
    }

    return this.getState();
  }

  private async runJobs(startIndex: number, endIndex = this.queue.jobs.length - 1): Promise<QueueDefinition> {
    if (this.queue.status === "running") {
      return this.getState();
    }

    this.stopRequested = false;
    this.queue.status = "running";
    this.touch();

    for (let index = startIndex; index <= endIndex; index += 1) {
      const job = this.queue.jobs[index];

      if (!job || job.status === "skipped" || job.status === "succeeded") {
        continue;
      }

      if (this.stopRequested) {
        this.queue.status = "stopped";
        this.touch();
        return this.getState();
      }

      job.status = "queued";
      this.touch();

      const result = await this.runSingleJob(job);

      if (this.stopRequested) {
        job.status = "stopped";
        this.queue.status = "stopped";
        this.touch();
        return this.getState();
      }

      this.applyResult(job, result);

      if (result.exitCode !== 0) {
        this.queue.status = "failed";
        this.touch();
        return this.getState();
      }
    }

    this.queue.status = "succeeded";
    this.touch();
    return this.getState();
  }

  private async runSingleJob(job: QueueJob): Promise<JobRunResult> {
    job.status = "running";
    this.queue.activeJobId = job.id;
    this.touch();

    const running = this.runner.start(job);
    this.activeStop = running.stop;

    try {
      return await running.promise;
    } catch {
      return {
        exitCode: 1,
        signal: null,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        artifacts: {
          runId: `${job.id}-failed-run`,
          runDir: "",
          stdoutPath: "",
          stderrPath: "",
          metaPath: ""
        }
      };
    } finally {
      this.activeStop = undefined;
      this.queue.activeJobId = undefined;
    }
  }

  private applyResult(job: QueueJob, result: JobRunResult): void {
    job.exitCode = result.exitCode;
    job.startedAt = result.startedAt;
    job.endedAt = result.endedAt;
    job.artifacts = result.artifacts;
    job.status = result.exitCode === 0 ? "succeeded" : "failed";
    this.touch();
  }

  private touch(): void {
    this.queue.updatedAt = new Date().toISOString();
    this.emit("state", this.getState());
  }
}
