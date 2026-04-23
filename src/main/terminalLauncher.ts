import { spawn } from "node:child_process";

export interface TerminalLaunchRequest {
  command: string;
  scriptPath: string;
}

export type TerminalLauncher = (request: TerminalLaunchRequest) => Promise<void>;

export function createMacOsTerminalLauncher(): TerminalLauncher {
  return async ({ command }) =>
    await new Promise<void>((resolve, reject) => {
      const stderr: string[] = [];
      const child = spawn(
        "osascript",
        [
          "-e",
          'tell application "Terminal"',
          "-e",
          "activate",
          "-e",
          `do script ${toAppleScriptString(command)}`,
          "-e",
          "end tell"
        ],
        {
          stdio: ["ignore", "ignore", "pipe"]
        }
      );

      child.stderr?.on("data", (chunk: Buffer | string) => {
        stderr.push(chunk.toString());
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr.join("").trim() || `osascript exited with code ${code}`));
      });
    });
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function toAppleScriptString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
