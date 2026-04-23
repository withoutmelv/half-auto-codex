import {
  createDefaultQueueJob,
  DEFAULT_JOB_INSTRUCTION,
  normalizeCodexOptions,
  normalizeJobInstruction
} from "../src/shared/defaults";

test("default instruction continues the superpowers plan flow", () => {
  expect(DEFAULT_JOB_INSTRUCTION).toBe(
    "当前已经实现好了 plans 文档，继续按照 superpowers 的流程执行下去，中途不要停止直到任务完成。"
  );
});

test("createDefaultQueueJob presets instruction and codex options", () => {
  const job = createDefaultQueueJob({
    id: "job-1",
    name: "任务 1"
  });

  expect(job.instruction).toBe(DEFAULT_JOB_INSTRUCTION);
  expect(job.codexOptions).toEqual({
    sandbox: "danger-full-access",
    fullAuto: true,
    addDirs: []
  });
});

test("normalizeCodexOptions upgrades legacy execution config and removes stale model", () => {
  expect(
    normalizeCodexOptions({
      sandbox: "workspace-write",
      fullAuto: false,
      model: "gpt-5",
      profile: "default",
      addDirs: ["/tmp/workspace"],
      skipGitRepoCheck: true
    })
  ).toEqual({
    sandbox: "danger-full-access",
    fullAuto: true,
    profile: "default",
    addDirs: ["/tmp/workspace"],
    skipGitRepoCheck: true
  });
});

test("normalizeJobInstruction migrates legacy default instructions", () => {
  const legacyInstruction = [
    "要求继续按照 superpowers 的流程执行下去，当前已经实现好了 plans 文档。",
    "请读取并严格执行选定的 plan 文档，完成实现、验证，并在最终回复中总结变更与验证结果。"
  ].join("\n");

  expect(normalizeJobInstruction("")).toBe(DEFAULT_JOB_INSTRUCTION);
  expect(normalizeJobInstruction("   ")).toBe(DEFAULT_JOB_INSTRUCTION);
  expect(normalizeJobInstruction(legacyInstruction)).toBe(DEFAULT_JOB_INSTRUCTION);
});

test("normalizeJobInstruction keeps custom instructions", () => {
  const customInstruction = "我要出去了，按照选定的plan计划文档，实现功能";

  expect(normalizeJobInstruction(customInstruction)).toBe(customInstruction);
});
