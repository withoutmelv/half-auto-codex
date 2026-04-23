import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { QueueJob } from "../src/shared/types";
import { CodexRunner } from "../src/main/codexRunner";

function createJob(planFiles: string[]): QueueJob {
  return {
    id: "job_01",
    name: "执行桌面任务",
    cwd: process.cwd(),
    instruction: "按照计划执行任务",
    planFiles,
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

test("CodexRunner launches a run script and waits for codex exit", async () => {
  const root = await mkdtemp(join(tmpdir(), "runner-test-"));
  const planPath = join(root, "plans", "plan.md");
  const binPath = join(root, "codex-stub.sh");
  const dataDir = join(root, "app-data");

  await mkdir(join(root, "plans"), { recursive: true });
  await writeFile(planPath, "# plan");
  await writeFile(
    binPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "prompt_arg=''",
      "printf '%s\\0' \"$@\" > \"$TMPDIR/codex-args.bin\"",
      "while (($#)); do",
      "  case \"$1\" in",
      "    exec)",
      "      shift",
      "      ;;",
      "    -o)",
      "      printf 'unexpected -o\\n' >&2",
      "      exit 98",
      "      ;;",
      "    -m|--model)",
      "      printf 'unexpected model override\\n' >&2",
      "      exit 95",
      "      ;;",
      "    --add-dir|-p|--profile|-s|--sandbox)",
      "      shift 2",
      "      ;;",
      "    -C)",
      "      printf 'unexpected -C\\n' >&2",
      "      exit 97",
      "      ;;",
      "    -)",
      "      printf 'unexpected stdin prompt sentinel\\n' >&2",
      "      exit 96",
      "      ;;",
      "    --json)",
      "      printf 'unexpected --json\\n' >&2",
      "      exit 94",
      "      ;;",
      "    --skip-git-repo-check|--full-auto)",
      "      shift",
      "      ;;",
      "    *)",
      "      prompt_arg=\"$1\"",
      "      shift",
      "      ;;",
      "  esac",
      "done",
      "printf '%s' \"$prompt_arg\" > \"$TMPDIR/prompt-captured.txt\"",
      "printf 'plain stdout line\\n'",
      "printf 'stderr line\\n' >&2",
      "exit 0"
    ].join("\n")
  );
  await chmod(binPath, 0o755);

  let launchedCommand = "";
  const runner = new CodexRunner({
    appDataDir: dataDir,
    codexBin: binPath,
    terminalLauncher: async ({ command }) => {
      launchedCommand = command;
      const scriptPath = command.match(/bash '([^']+run\.sh)'/)?.[1];
      if (!scriptPath) {
        throw new Error(`missing run script command: ${command}`);
      }
      spawn(scriptPath, {
        stdio: "ignore"
      });
    }
  });

  const run = runner.start("queue_01", createJob([planPath]));
  const result = await run.promise;

  expect(result.exitCode).toBe(0);

  const capturedPrompt = await readFile(join(tmpdir(), "prompt-captured.txt"), "utf8");
  const stdoutText = await readFile(result.artifacts.stdoutPath, "utf8");
  const stderrText = await readFile(result.artifacts.stderrPath, "utf8");
  const runScript = await readFile(join(result.artifacts.runDir, "run.sh"), "utf8");
  const runDirEntries = await readdir(result.artifacts.runDir);
  const codexArgs = (await readFile(join(tmpdir(), "codex-args.bin")))
    .toString("utf8")
    .split("\0")
    .filter(Boolean);

  expect(launchedCommand).toBe(`cd '${process.cwd()}' && bash '${join(result.artifacts.runDir, "run.sh")}'`);
  expect(capturedPrompt).toBe(`按照计划执行任务计划文件：${planPath}`);
  expect(stdoutText).toContain("plain stdout line");
  expect(stderrText).toContain("stderr line");
  expect(runScript).toContain(`'${binPath}' 'exec'`);
  expect(runScript).toContain("codex_pid=$!");
  expect(runScript).toContain("exit-code.txt");
  expect(runDirEntries).toContain("run.sh");
  expect(codexArgs).not.toContain("--json");
  expect(codexArgs).not.toContain("-o");
  expect(codexArgs).not.toContain("-m");
  expect(codexArgs).not.toContain("-");
  expect(codexArgs).toContain("--skip-git-repo-check");
  expect(codexArgs).toContain("--add-dir");
  expect(codexArgs).toContain(join(root, "plans"));
  expect(codexArgs.at(-1)).toBe(capturedPrompt);
});

test("CodexRunner skips git repo check by default", async () => {
  const root = await mkdtemp(join(tmpdir(), "runner-skip-git-test-"));
  const planPath = join(root, "plan.md");
  const binPath = join(root, "codex-stub.sh");
  const dataDir = join(root, "app-data");

  await writeFile(planPath, "# plan");
  await writeFile(
    binPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "has_skip_git='false'",
      "while (($#)); do",
      "  case \"$1\" in",
      "    -o)",
      "      printf 'unexpected -o\\n' >&2",
      "      exit 98",
      "      ;;",
      "    --json)",
      "      printf 'unexpected --json\\n' >&2",
      "      exit 94",
      "      ;;",
      "    --skip-git-repo-check)",
      "      has_skip_git='true'",
      "      shift",
      "      ;;",
    "    -)",
      "      shift",
      "      ;;",
    "    *)",
      "      shift",
      "      ;;",
      "  esac",
      "done",
      "cat >/dev/null",
      "if [[ \"$has_skip_git\" != 'true' ]]; then",
      "  printf 'Not inside a trusted directory and --skip-git-repo-check was not specified.\\n' >&2",
      "  exit 1",
      "fi",
      "exit 0"
    ].join("\n")
  );
  await chmod(binPath, 0o755);

  const runner = new CodexRunner({
    appDataDir: dataDir,
    codexBin: binPath,
    terminalLauncher: async ({ command }) => {
      await writeFile(join(root, "launched-command.txt"), command);
      const scriptPath = command.match(/bash '([^']+run\.sh)'/)?.[1];
      if (!scriptPath) {
        throw new Error(`missing run script command: ${command}`);
      }
      spawn(scriptPath, {
        stdio: "ignore"
      });
    }
  });

  const result = await runner.start("queue_01", createJob([planPath])).promise;
  const launchedCommand = await readFile(join(root, "launched-command.txt"), "utf8");
  const runScript = await readFile(join(result.artifacts.runDir, "run.sh"), "utf8");

  expect(result.exitCode).toBe(0);
  expect(launchedCommand).toContain("run.sh");
  expect(runScript).toContain("--skip-git-repo-check");
});
