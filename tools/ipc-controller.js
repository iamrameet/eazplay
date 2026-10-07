/// <reference path="../helper/util.d.ts"/>

/** @typedef {import("electron")} Electron */

/** @typedef {{ [channel: string]: (event: IPCControllerEvent, ...args: any[]) => any }} IPCControllerChannels */
/**
 * @template {IPCControllerTemplate<any, any>} T
 * @typedef {(T extends IPCControllerTemplate<infer C, infer M> ? C : never)} InferTemplateChannels
 */
/**
 * @template {IPCControllerTemplate<any, any>} T
 * @typedef {(T extends IPCControllerTemplate<infer C, infer M> ? M : never)} InferTemplateEvents
 */

/** @typedef {{ [eventType: string]: any[] }} IPCControllerAPIEventsMap */

class IPCControllerEvent {
  /**
   * @param {Electron.IpcMainEvent} ipcMainEvent
   * @param {Electron.App} app
   * @param {Electron.IpcMain} ipcMain
  */
  constructor(ipcMainEvent, app, ipcMain) {
    this.ipcMainEvent = ipcMainEvent;
    this.app = app;
    this.ipcMain = ipcMain;
  }
};

/**
 * @template {IPCControllerChannels} T
 * @template {IPCControllerAPIEventsMap} M
*/
export class IPCControllerTemplate {

  #channels;
  /** @type {M} */
  events;
  // #events;

  /**
   * @param {T} channels
   * @param {M} events
   */
  constructor(channels, events = {}) {
    this.#channels = Object.freeze(channels);
    // this.#events = events;
  }

  get channels() {
    return this.#channels;
  }

  /**
   * @template {{ [name: string]: IPCControllerTemplate }} T
   * @param {T} controllers
   * @returns {IPCControllerTemplate<{ [K in Extract<keyof T, string> as `${ K }:${ Extract<keyof InferTemplateChannels<T[K]>, string> }`]: InferTemplateChannels<T[K]>[keyof InferTemplateChannels<T[K]>] }, { [K in Extract<keyof T, string> as `${ K }:${ Extract<keyof InferTemplateEvents<T[K]>, string> }`]: InferTemplateEvents<T[K]>[keyof InferTemplateEvents<T[K]>] }>}
   */
  static merge(controllers) {
    const channels = {};
    for(const [controllerName, controller] of Object.entries(controllers)) {
      for(const [channelName, listener] of Object.entries(controller.#channels)) {
        channels[`${ controllerName }:${ channelName }`] = listener;
      }
    }
    return new IPCControllerTemplate(channels);
  }

};

/**
 * @template {{ [name: string]: IPCControllerTemplate }} U
 * @typedef {{ [L in keyof U as `${ L }:${ keyof U[L]["channels"] }`]: U }} IPCControllerTemplatesChannels */

/**
 * @template {{ [name: string]: IPCControllerTemplate }} U
 * @typedef {{ [L in keyof U as `${ L }:${ keyof U[L]["events"] }`]: U }} IPCControllerTemplatesEvents */

/**
 * @template {IPCControllerChannels} T
 * @template {IPCControllerAPIEventsMap} M
 * @template {{ [name: string]: IPCControllerTemplate }} U
 * @extends {IPCControllerTemplate<T, M>}
 */
export class IPCController extends IPCControllerTemplate {

  #app;
  #templates;

  /**
   * @param {Electron.App} app
   * @param {T} channels
   * @param {M} events
   * @param {U} templates
   */
  constructor(app, channels, events = {}, templates = {}) {
    super(channels);
    this.#app = app;
    this.#templates = templates;
  }

  /** @param {Electron.IpcMain} ipcMain */
  assignChannels(ipcMain) {
    for(const key in this.channels) {
      ipcMain.handle(key, async (event, ...args) => {
        return await this.channels[key](new IPCControllerEvent(event, this.#app, ipcMain), ...args);
      });
    }
    for(const templateName in this.#templates) {
      for(const key in this.#templates[templateName].channels) {
        const channelName = `${ templateName }:${ key }`;
        ipcMain.handle(channelName, async (event, ...args) => {
          return await this.#templates[templateName].channels[key](new IPCControllerEvent(event, this.#app, ipcMain), ...args);
        });
      }
    }
  }

  /** @param {Electron.IpcRenderer} ipcRenderer */
  createAPI(ipcRenderer) {
    return {
      /**
       * @template {keyof (T & IPCControllerTemplatesChannels<U>)} K
       * @param {K} channelName
       * @param {K extends keyof T ? Parameters<ExcludeFirstParameter<T[K]>> : K extends `${ infer A }:${ infer B }` ? Parameters<ExcludeFirstParameter<U[A]["channels"][B]>> : any[]} args
       * @returns {K extends keyof T ? ReturnType<T[K]> : K extends `${ infer A }:${ infer B }` ? ReturnType<U[A]["channels"][B]> : any}
      */
      invoke(channelName, ...args) {
        return ipcRenderer.invoke(channelName, ...args);
      },
      /** @type {<K extends keyof (M & IPCControllerTemplatesEvents<U>)>(eventName: K, listener: (...args: K extends keyof M ? M[K] : K extends `${ infer A }:${ infer B }` ? U[A]["events"][B] : any) => any)} */
      on(eventName, listener) {},
      /** @type {<K extends keyof M>(eventName: K, listener: (...args: M[K]) => any)} */
      off(eventName, listener) {}
    };
  }

  /**
   * @template {IPCController} T0
   * @template {{ [name: string]: IPCControllerTemplate }} T
   * @param {T0} mainController
   * @param {T} controllers
   * @returns {IPCController<T0 & { [K in keyof T as K extends string ? keyof InferTemplateChannels<T[K]> extends string ? `${ K }:${ keyof InferTemplateChannels<T[K]> }` : never : never]: InferTemplateChannels<T[K]>[keyof InferTemplateChannels<T[K]>] }>}
   */
  static join(mainController, controllers) {
    const channels = Object.assign({}, mainController.channels);
    for(const [controllerName, controller] of Object.entries(controllers)) {
      for(const [channelName, listener] of Object.entries(controller.channels)) {
        channels[`${ controllerName }:${ channelName }`] = listener;
      }
    }
    return new IPCController(mainController.#app, channels);
  }

  /**
   * @template {IPCController} A
   * @template {{ [name: string]: IPCControllerTemplate }} B
   * @param {A} controller
   * @param {B} controllerTemplate
   * @returns {IPCController<A["channels"], A["events"], B>}
   */
  static joinTemplate(controller, controllerTemplate) {
    return new IPCController(controller.#app, controller.channels, controller.events, controllerTemplate);
  }

};