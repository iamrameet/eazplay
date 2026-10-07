import { BrowserWindow } from "electron";
import { IPCControllerTemplate } from "../tools/ipc-controller.js";

const windowController = new IPCControllerTemplate({

  close(event) {
    const window = BrowserWindow.getFocusedWindow();
    window?.close();
    // event.app.quit();
  },

  minimize(event) {
    const window = BrowserWindow.getFocusedWindow();
    window?.minimize();
  },

  restore(event) {
    const window = BrowserWindow.getFocusedWindow();
    window?.restore();
  },

  maximize(event) {
    const window = BrowserWindow.getFocusedWindow();
    window?.maximize();
  },

  toggleMaximize(event) {
    const window = BrowserWindow.getFocusedWindow();
    if(window === null) {
      return;
    }
    if(window.isMaximized()) {
      return void window.unmaximize();
    }
    window.maximize();
  }

});

export default windowController;