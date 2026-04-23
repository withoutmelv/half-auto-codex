export type JobStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "stopped"
  | "skipped"
  | "interrupted";

export type QueueStatus = "idle" | "running" | "failed" | "stopped" | "succeeded";

export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

export interface CodexOptions {
  sandbox?: SandboxMode;
  profile?: string;
  fullAuto?: boolean;
  addDirs: string[];
  skipGitRepoCheck?: boolean;
}

export interface JobPolicy {
  onFailure: "stop";
}

export interface RunArtifacts {
  runId: string;
  runDir: string;
  stdoutPath: string;
  stderrPath: string;
  metaPath: string;
}

export interface QueueJob {
  id: string;
  name: string;
  cwd: string;
  instruction: string;
  planFiles: string[];
  codexOptions: CodexOptions;
  policy: JobPolicy;
  status: JobStatus;
  artifacts?: RunArtifacts;
  exitCode?: number | null;
  startedAt?: string;
  endedAt?: string;
}

export interface QueueDefinition {
  id: string;
  name: string;
  jobs: QueueJob[];
  status: QueueStatus;
  updatedAt: string;
  selectedJobId?: string;
  activeJobId?: string;
}

export interface JobRunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  startedAt: string;
  endedAt: string;
  artifacts: RunArtifacts;
}

export interface RunningJobHandle {
  promise: Promise<JobRunResult>;
  stop: () => Promise<void> | void;
}

export interface QueueRunner {
  start: (job: QueueJob) => RunningJobHandle;
}

export interface LoadedPlanFile {
  path: string;
  resolvedPath: string;
}

export interface RunnerOutputEvent {
  kind: "stdout" | "stderr" | "status";
  text: string;
  jobId: string;
  timestamp: string;
}

export interface CacheCleanupResult {
  removedEntries: number;
}

export interface RunnerCallbacks {
  onOutput?: (event: RunnerOutputEvent) => void;
}

export interface CodexQueueApi {
  getState: () => Promise<QueueDefinition>;
  saveQueue: (queue: QueueDefinition) => Promise<QueueDefinition>;
  startQueue: () => Promise<QueueDefinition>;
  stopQueue: () => Promise<QueueDefinition>;
  clearSystemCache: () => Promise<CacheCleanupResult>;
  pickPlanFiles: () => Promise<string[]>;
  pickDirectory: () => Promise<string | null>;
  onQueueState: (listener: (state: QueueDefinition) => void) => () => void;
  onRunnerOutput: (listener: (event: RunnerOutputEvent) => void) => () => void;
}
