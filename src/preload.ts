import { contextBridge, ipcRenderer } from "electron";

import type { CodexQueueApi, QueueDefinition, RunnerOutputEvent } from "./shared/types";

const api: CodexQueueApi = {
  getState() {
    return ipcRenderer.invoke("queue:get-state");
  },
  saveQueue(queue) {
    return ipcRenderer.invoke("queue:save", queue);
  },
  startQueue() {
    return ipcRenderer.invoke("queue:start");
  },
  stopQueue() {
    return ipcRenderer.invoke("queue:stop");
  },
  clearSystemCache() {
    return ipcRenderer.invoke("queue:clear-system-cache");
  },
  pickPlanFiles() {
    return ipcRenderer.invoke("dialog:pick-plan-files");
  },
  pickDirectory() {
    return ipcRenderer.invoke("dialog:pick-directory");
  },
  onQueueState(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, state: QueueDefinition) => {
      listener(state);
    };

    ipcRenderer.on("queue:state", wrapped);
    return () => ipcRenderer.removeListener("queue:state", wrapped);
  },
  onRunnerOutput(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, event: RunnerOutputEvent) => {
      listener(event);
    };

    ipcRenderer.on("runner:output", wrapped);
    return () => ipcRenderer.removeListener("runner:output", wrapped);
  }
};

contextBridge.exposeInMainWorld("codexQueue", api);
