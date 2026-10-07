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