import { appendFile, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { buildPrompt, loadPlanFiles } from "./prompt";
import { createRunArtifacts } from "./persistence";
import { createMacOsTerminalLauncher, shellQuote, type TerminalLauncher } from "./terminalLauncher";
import type {
  JobRunResult,
  LoadedPlanFile,
  QueueJob,
  RunnerCallbacks,
  RunningJobHandle
} from "../shared/types";

interface CodexRunnerOptions {
  appDataDir: string;
  codexBin?: string;
  terminalLauncher?: TerminalLauncher;
  pollIntervalMs?: number;
}

export class CodexRunner {
  private readonly appDataDir: string;
  private readonly codexBin: string;
  private readonly terminalLauncher: TerminalLauncher;
  private readonly pollIntervalMs: number;

  constructor(options: CodexRunnerOptions) {
    this.appDataDir = options.appDataDir;
    this.codexBin = options.codexBin ?? "codex";
    this.terminalLauncher = options.terminalLauncher ?? createMacOsTerminalLauncher();
    this.pollIntervalMs = options.pollIntervalMs ?? 250;
  }

  start(queueId: string, job: QueueJob, callbacks?: RunnerCallbacks): RunningJobHandle {
    let codexPidPath: string | undefined;
    let settled = false;
    let stopRequested = false;
    const startedAt = new Date().toISOString();

    const promise = (async (): Promise<JobRunResult> => {
      const artifacts = await createRunArtifacts(this.appDataDir, queueId, job.id);
      const plans = await loadPlanFiles(job);
      const prompt = buildPrompt(job, plans);
      const executionCwd = job.cwd || process.cwd();

      await mkdir(artifacts.runDir, { recursive: true });
      await writeFile(artifacts.stdoutPath, "", "utf8");
      await writeFile(artifacts.stderrPath, "", "utf8");

      const args = this.buildArgs(job, plans, executionCwd, prompt);
      const commandLine = this.buildCommandLine(args);
      const runScriptPath = join(artifacts.runDir, "run.sh");
      const exitCodePath = join(artifacts.runDir, "exit-code.txt");
      codexPidPath = join(artifacts.runDir, "codex.pid");
      const terminalCommand = `cd ${shellQuote(executionCwd)} && bash ${shellQuote(runScriptPath)}`;

      await writeFile(
        runScriptPath,
        this.buildRunScript({
          args,
          codexPidPath,
          executionCwd,
          exitCodePath,
          stderrPath: artifacts.stderrPath,
          stdoutPath: artifacts.stdoutPath
        }),
        "utf8"
      );
      await chmod(runScriptPath, 0o755);

      return await new Promise<JobRunResult>((resolve) => {
        const finish = async (
          exitCode: number | null,
          signal: NodeJS.Signals | null,
          errorText?: string
        ) => {
          if (settled) {
            return;
          }

          settled = true;

          if (errorText) {
            await appendFile(artifacts.stderrPath, `${errorText}\n`, "utf8");
          }

          const endedAt = new Date().toISOString();

          await writeFile(
            artifacts.metaPath,
            JSON.stringify(
              {
                queueId,
                jobId: job.id,
                args,
                command: commandLine,
                terminalCommand,
                mode: "terminal",
                startedAt,
                endedAt,
                exitCode,
                signal,
                stopRequested
              },
              null,
              2
            ),
            "utf8"
          );

          resolve({
            exitCode,
            signal,
            startedAt,
            endedAt,
            artifacts
          });
        };

        this.emitOutput(callbacks, job.id, "status", `Opening Terminal: cd ${executionCwd}\n${commandLine}`);

        void (async () => {
          try {
            await this.terminalLauncher({
              command: terminalCommand,
              scriptPath: runScriptPath
            });

            const exitCode = await this.waitForTerminalRun({
              artifacts,
              callbacks,
              exitCodePath,
              jobId: job.id
            });

            await finish(exitCode, null);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await finish(127, null, message);
          }
        })();
      });
    })();

    return {
      promise,
      stop: async () => {
        stopRequested = true;

        if (!codexPidPath) {
          return;
        }

        await this.stopCodexProcess(codexPidPath);
      }
    };
  }

  private buildArgs(
    job: QueueJob,
    plans: LoadedPlanFile[],
    executionCwd: string,
    prompt: string
  ): string[] {
    const args = ["exec"];

    if (job.codexOptions.profile) {
      args.push("-p", job.codexOptions.profile);
    }

    if (job.codexOptions.fullAuto) {
      args.push("--full-auto");
    } else if (job.codexOptions.sandbox) {
      args.push("-s", job.codexOptions.sandbox);
    }

    if (job.codexOptions.skipGitRepoCheck !== false) {
      args.push("--skip-git-repo-check");
    }

    for (const dir of this.getReadableDirs(job, plans, executionCwd)) {
      args.push("--add-dir", dir);
    }

    args.push(prompt);
    return args;
  }

  private buildCommandLine(args: string[]): string {
    return [this.codexBin, ...args].map(shellQuote).join(" ");
  }

  private buildRunScript({
    args,
    codexPidPath,
    executionCwd,
    exitCodePath,
    stderrPath,
    stdoutPath
  }: {
    args: string[];
    codexPidPath: string;
    executionCwd: string;
    exitCodePath: string;
    stderrPath: string;
    stdoutPath: string;
  }): string {
    const commandLine = this.buildCommandLine(args);
    const stdoutPipePath = `${stdoutPath}.pipe`;
    const stderrPipePath = `${stderrPath}.pipe`;

    return [
      "#!/usr/bin/env bash",
      "set -u",
      "",
      "finish() {",
      "  local exit_code=\"$1\"",
      `  printf '%s' "$exit_code" > ${shellQuote(exitCodePath)}`,
      "  printf '\\n[Codex Queue] exited with code %s\\n' \"$exit_code\"",
      "  exit \"$exit_code\"",
      "}",
      "",
      `stdout_pipe=${shellQuote(stdoutPipePath)}`,
      `stderr_pipe=${shellQuote(stderrPipePath)}`,
      "cleanup() {",
      "  rm -f \"$stdout_pipe\" \"$stderr_pipe\"",
      "}",
      "trap cleanup EXIT",
      "rm -f \"$stdout_pipe\" \"$stderr_pipe\"",
      "mkfifo \"$stdout_pipe\" \"$stderr_pipe\" || finish $?",
      `tee -a ${shellQuote(stdoutPath)} < "$stdout_pipe" &`,
      "stdout_tee_pid=$!",
      `tee -a ${shellQuote(stderrPath)} >&2 < "$stderr_pipe" &`,
      "stderr_tee_pid=$!",
      "",
      `printf '+ cd %s\\n' ${shellQuote(executionCwd)}`,
      `cd ${shellQuote(executionCwd)} || finish $?`,
      `printf '+ %s\\n' ${shellQuote(commandLine)}`,
      "",
      "set +e",
      `${commandLine} > "$stdout_pipe" 2> "$stderr_pipe" &`,
      "codex_pid=$!",
      `printf '%s' "$codex_pid" > ${shellQuote(codexPidPath)}`,
      "wait \"$codex_pid\"",
      "exit_code=$?",
      "wait \"$stdout_tee_pid\"",
      "wait \"$stderr_tee_pid\"",
      "set -e",
      "finish \"$exit_code\"",
      ""
    ].join("\n");
  }

  private async waitForTerminalRun({
    artifacts,
    callbacks,
    exitCodePath,
    jobId
  }: {
    artifacts: JobRunResult["artifacts"];
    callbacks?: RunnerCallbacks;
    exitCodePath: string;
    jobId: string;
  }): Promise<number> {
    const state = {
      stdoutOffset: 0,
      stderrOffset: 0
    };

    while (true) {
      await this.pumpTerminalOutput(artifacts, state, callbacks, jobId);

      const exitCodeText = await this.readOptionalFile(exitCodePath);

      if (exitCodeText !== undefined) {
        await this.pumpTerminalOutput(artifacts, state, callbacks, jobId);
        return Number.parseInt(exitCodeText.trim(), 10);
      }

      await sleep(this.pollIntervalMs);
    }
  }

  private async pumpTerminalOutput(
    artifacts: JobRunResult["artifacts"],
    state: {
      stdoutOffset: number;
      stderrOffset: number;
    },
    callbacks: RunnerCallbacks | undefined,
    jobId: string
  ): Promise<void> {
    const stdout = (await this.readOptionalFile(artifacts.stdoutPath)) ?? "";

    if (stdout.length > state.stdoutOffset) {
      const text = stdout.slice(state.stdoutOffset);
      state.stdoutOffset = stdout.length;
      this.emitOutput(callbacks, jobId, "stdout", text);
    }

    const stderr = (await this.readOptionalFile(artifacts.stderrPath)) ?? "";

    if (stderr.length > state.stderrOffset) {
      const text = stderr.slice(state.stderrOffset);
      state.stderrOffset = stderr.length;
      this.emitOutput(callbacks, jobId, "stderr", text);
    }
  }

  private getReadableDirs(job: QueueJob, plans: LoadedPlanFile[], executionCwd: string): string[] {
    const dirs = new Set(job.codexOptions.addDirs);

    for (const plan of plans) {
      if (!isPathInside(executionCwd, plan.resolvedPath)) {
        dirs.add(dirname(plan.resolvedPath));
      }
    }

    return [...dirs];
  }

  private emitOutput(
    callbacks: RunnerCallbacks | undefined,
    jobId: string,
    kind: "stdout" | "stderr" | "status",
    text: string
  ): void {
    callbacks?.onOutput?.({
      kind,
      text,
      jobId,
      timestamp: new Date().toISOString()
    });
  }

  private async readOptionalFile(filePath: string): Promise<string | undefined> {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }

      throw error;
    }
  }

  private async stopCodexProcess(codexPidPath: string): Promise<void> {
    const pidText = await this.readOptionalFile(codexPidPath);
    const pid = pidText ? Number.parseInt(pidText, 10) : Number.NaN;

    if (!Number.isSafeInteger(pid) || pid <= 0) {
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        throw error;
      }
    }
  }
}

function isPathInside(parent: string, child: string): boolean {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
