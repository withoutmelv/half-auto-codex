import { access } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type { LoadedPlanFile, QueueJob } from "../shared/types";

export async function loadPlanFiles(job: QueueJob): Promise<LoadedPlanFile[]> {
  const plans = await Promise.all(
    job.planFiles.map(async (path) => {
      const resolvedPath = resolvePlanPath(job.cwd, path);

      try {
        await access(resolvedPath);
        return { path, resolvedPath };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read plan file: ${path}. ${detail}`);
      }
    })
  );

  return plans;
}

export function buildPrompt(job: QueueJob, plans: LoadedPlanFile[]): string {
  const planReferences = plans
    .map((plan, index) => `${index === 0 ? "" : " "}计划文件：${plan.resolvedPath}`)
    .join("");

  return `${job.instruction.trimEnd()}${planReferences}`;
}

function resolvePlanPath(cwd: string, path: string): string {
  if (isAbsolute(path)) {
    return path;
  }

  return resolve(cwd || process.cwd(), path);
}
