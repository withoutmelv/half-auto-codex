import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { app, BrowserWindow } from "electron";

import { registerIpcHandlers } from "./ipc";
import { createMainWindowOptions } from "./windowOptions";

let mainWindow: BrowserWindow | null = null;

function revealMainWindow(): void {
  mainWindow?.show();
  mainWindow?.focus();

  if (process.platform === "darwin") {
    app.focus({ steal: true });
  }
}

async function createMainWindow(): Promise<void> {
  const preloadPath = join(__dirname, "../preload.js");

  mainWindow = new BrowserWindow(createMainWindowOptions(preloadPath));

  mainWindow.once("ready-to-show", () => {
    revealMainWindow();
  });

  await registerIpcHandlers(mainWindow, app.getPath("userData"));

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../../dist/index.html"));
  }

  revealMainWindow();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await mkdir(app.getPath("userData"), { recursive: true });
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
