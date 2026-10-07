const { contextBridge, ipcRenderer } = require("electron");

/** @typedef {typeof ipcController extends import("./tools/ipc-controller").IPCController<infer T> ? T : never} IPCChannelsMap */

const privateControllerAPI = {

  /** @type {Map<(event: Electron.IpcRendererEvent, ...args: any[]) => void, (...args: any[]) => void>} */
  listenersMap: new WeakMap(),

  /**
   * @param {(event: Electron.IpcRendererEvent, ...args: any[]) => void} listener
   * @returns {(...args: any[]) => void}
   */
  setOrGetListener(listener) {
    if(!this.listenersMap.has(listener)) {
      this.listenersMap.set(listener, (_event, ...args) => listener(...args));
    }
    return this.listenersMap.get(listener);
  }

};

/** @type {ReturnType<import("./tools/ipc-controller").IPCController<IPCChannelsMap>["createAPI"]>} */
const controllerAPI = {
  invoke(channelName, ...args) {
    return ipcRenderer.invoke(channelName, ...args);
  },
  on(eventName, listener) {
    ipcRenderer.on(eventName, privateControllerAPI.setOrGetListener(listener));
  },
  once(eventName, listener) {
    ipcRenderer.once(eventName, privateControllerAPI.setOrGetListener(listener));
  },
  off(eventName, listener) {
    ipcRenderer.off(eventName, privateControllerAPI.setOrGetListener(listener));
  }
};

contextBridge.exposeInMainWorld("electronAPI", controllerAPI);

window.addEventListener("DOMContentLoaded", async function() {

  const { "app.version": appVersion } = await electronAPI.invoke("app:config");
  const cache = await this.caches.open("v-" + appVersion);
  await cache.add({ url: "templates/lists/list-item.css" });

  function replaceText(elementId, text) {
    const element = document.getElementById(elementId);
    if(element !== null) {
      element.innerText = text;
    }
  }

  for(const dependency of ["chrome", "node", "electron"]) {
    replaceText(`${ dependency }-version`, process.versions[dependency]);
  }

});
