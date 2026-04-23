import { join } from "node:path";

import { createMainWindowOptions } from "../src/main/windowOptions";

test("main window options keep the Electron preload API available", () => {
  const preloadPath = join("dist-electron", "preload.js");
  const options = createMainWindowOptions(preloadPath);

  expect(options.show).toBe(false);
  expect(options.backgroundColor).toBe("#0F1115");
  expect(options.webPreferences?.preload).toBe(preloadPath);
  expect(options.webPreferences?.contextIsolation).toBe(true);
  expect(options.webPreferences?.nodeIntegration).toBe(false);
  expect(options.webPreferences?.sandbox).toBe(false);
});
