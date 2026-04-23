import type { CodexQueueApi } from "../shared/types";

declare global {
  interface Window {
    codexQueue: CodexQueueApi;
  }
}

export {};
