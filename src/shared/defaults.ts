import type { CodexOptions, QueueJob } from "./types";

export const DEFAULT_JOB_INSTRUCTION =
  "当前已经实现好了 plans 文档，继续按照 superpowers 的流程执行下去，中途不要停止直到任务完成。";

const LEGACY_DEFAULT_JOB_INSTRUCTIONS = new Set([
  [
    "要求继续按照 superpowers 的流程执行下去，当前已经实现好了 plans 文档。",
    "请读取并严格执行选定的 plan 文档，完成实现、验证，并在最终回复中总结变更与验证结果。"
  ].join("\n")
]);

export function normalizeJobInstruction(instruction: string): string {
  const trimmedInstruction = instruction.trim();

  if (!trimmedInstruction || LEGACY_DEFAULT_JOB_INSTRUCTIONS.has(trimmedInstruction)) {
    return DEFAULT_JOB_INSTRUCTION;
  }

  return instruction;
}

export function normalizeCodexOptions(
  codexOptions: Partial<CodexOptions> & { model?: string } = {}
): CodexOptions {
  const { model: _staleModel, ...rest } = codexOptions;

  return {
    ...rest,
    sandbox: "danger-full-access",
    fullAuto: true,
    addDirs: [...(rest.addDirs ?? [])]
  };
}

export function createDefaultQueueJob({ id, name }: { id: string; name: string }): QueueJob {
  return {
    id,
    name,
    cwd: "",
    instruction: DEFAULT_JOB_INSTRUCTION,
    planFiles: [],
    codexOptions: normalizeCodexOptions(),
    policy: {
      onFailure: "stop"
    },
    status: "idle"
  };
}
