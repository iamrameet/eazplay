declare type UntilOptions = {
  controller?: EventController,
  timeout?: number,
  rejectOnAbort?: boolean
};

declare interface EventTarget {
  declare until(eventType: string, options?: UntilOptions): Promise<Event>;
}

declare interface Window {
  declare until<K extends keyof WindowEventMap>(eventType: K, options?: UntilOptions): Promise<WindowEventMap[K]>;
}

declare interface HTMLElement {
  declare until<K extends keyof HTMLElementEventMap>(eventType: K, options?: UntilOptions): Promise<HTMLElementEventMap[K]>;
}

declare type IPCChannelsMap = typeof ipcController extends import("../../tools/ipc-controller").IPCController<infer T extends {} ? infer T : never, any, any> ? T : never;
declare type IPCEventsMap = typeof ipcController extends import("../../tools/ipc-controller").IPCController<any, infer M extends {} ? infer M : never, any> ? M : never;
declare type IPCTemplatesMap = typeof ipcController extends import("../../tools/ipc-controller").IPCController<any, any, infer U extends {} ? infer U : never> ? U : never;

declare const electronAPI: ReturnType<import("../../tools/ipc-controller").IPCController<IPCChannelsMap, IPCEventsMap, IPCTemplatesMap>["createAPI"]>;