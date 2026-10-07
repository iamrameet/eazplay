import { createRequire } from "node:module";
import path from "path";
import { fileURLToPath } from "url";
import { IPCController } from "./tools/ipc-controller.js";
import Logger from "./library/logger.js";
import ipcControllers from "./controllers/index.js";
import config from "./config.json" with { type: "json" };
import MediaFileSystem from "./tools/media-file-system.js";


const require = createRequire(import.meta.url);

const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell } = require("electron");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

Logger.init({
  testing: true,
  dirname: __dirname,
  type: [ "TOTP" ]
})

try {
  await MediaFileSystem.setThumbnailPath(app.getPath("userData"), "album_arts");
  await MediaFileSystem.setLyricsPath(path.join(app.getPath("userData"), "lyrics"));
} catch(ex) {
  Logger.error(ex);
  app.exit();
}

function createWindow() {

  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      devTools: true
    }
  });

  window.loadFile(path.join(__dirname, "public", "index.html"));

  window.webContents.on("will-navigate", function(event, url) {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  window.webContents.toggleDevTools();

  return window;

};

const mainIpcController = new IPCController(app, {

  /** @param {{ multiple?: boolean; kind?: "directory" | "file"; filters?: Electron.FileFilter[] }} options */
  async "dialog:openFile"(event, options = {}) {
    /** @type {Electron.OpenDialogOptions["properties"]} */
    const properties = [];
    if(options.multiple) {
      properties.push("multiSelections");
    }
    switch(options.kind) {
      case "directory": properties.push("openDirectory");
      break;
      case "file": properties.push("openFile");
    }
    return await dialog.showOpenDialog(null, { filters: options.filters, properties });
  },

  async "dirent:showInExplorer"(event, path) {
    shell.showItemInFolder(path);
  },

  /** @returns {Promise<{ [K in keyof typeof config as `app.${K}`]: config[K] }>} */
  async "app:config"(event) {
    return Object.fromEntries(Object.entries(config).map(([ key, value ]) => [ `app.${ key }`, value ]));
  }

}, /** @type {{ "app:exit": [] }} */ ({}));

globalThis.ipcController = IPCController.joinTemplate(mainIpcController, ipcControllers);

// await ipcControllers.folders.channels.resetDatabase();

app.whenReady().then(() => {

  ipcController.assignChannels(ipcMain);

  createWindow();

  app.on("activate", () => {
    if(BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

});

app.on("window-all-closed", () => {
  if(process.platform !== "darwin") {
    app.quit();
  }
});

// const keyDisableProcess = spawn("./exe_build/window_key.exe");

// keyDisableProcess.on("exit", function(exitCode) {
//   console.log({ exitCode });
// });