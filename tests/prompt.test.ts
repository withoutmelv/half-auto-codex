import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { QueueJob } from "../src/shared/types";
import { buildPrompt, loadPlanFiles } from "../src/main/prompt";

function createJob(planFiles: string[]): QueueJob {
  return {
    id: "job_01",
    name: "实现设置页",
    cwd: "/tmp/project",
    instruction: "按照计划文件完成设置页实现",
    planFiles,
    codexOptions: {
      sandbox: "workspace-write",
      fullAuto: true,
      addDirs: []
    },
    policy: {
      onFailure: "stop"
    },
    status: "idle"
  };
}

test("buildPrompt returns a compact inline instruction with plan file paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-test-"));
  const first = join(root, "spec.md");
  const second = join(root, "plan.md");

  await writeFile(first, "# Spec A");
  await writeFile(second, "# Plan B");

  const job = createJob([first, second]);
  const plans = await loadPlanFiles(job);
  const prompt = buildPrompt(job, plans);

  expect(prompt).toBe(
    [
      `按照计划文件完成设置页实现计划文件：${first}`,
      `计划文件：${second}`
    ].join(" ")
  );
  expect(prompt.indexOf(first)).toBeLessThan(prompt.indexOf(second));
  expect(prompt).not.toContain("# Spec A");
  expect(prompt).not.toContain("# Plan B");
});

test("loadPlanFiles throws a readable error when a plan file is missing", async () => {
  const missingPath = join(tmpdir(), "does-not-exist-plan.md");
  const job = createJob([missingPath]);

  await expect(loadPlanFiles(job)).rejects.toThrow(missingPath);
});

test("loadPlanFiles resolves relative plan paths from job cwd", async () => {
  const root = await mkdtemp(join(tmpdir(), "prompt-relative-test-"));
  const relativePath = "plans/feature-plan.md";
  const absolutePath = join(root, relativePath);

  await mkdir(join(root, "plans"), { recursive: true });
  await writeFile(absolutePath, "# Plan");

  const job = {
    ...createJob([relativePath]),
    cwd: root
  };

  const plans = await loadPlanFiles(job);

  expect(plans).toEqual([
    {
      path: relativePath,
      resolvedPath: absolutePath
    }
  ]);
});
