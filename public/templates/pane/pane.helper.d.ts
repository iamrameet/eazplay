import { PaneChangeEvent, PanesManager } from "./pane";

interface PanesManagerEventMap<T extends string> {
  beforepanechange: (this: PanesManager<T>, event: PaneChangeEvent) => void;
  panechange: (this: PanesManager<T>, event: PaneChangeEvent) => void;
}

declare global {
  declare interface HTMLElement {
    addEventListener<N = this extends PanesManager<infer N> ? N : string, K extends keyof PanesManagerEventMap<N> >(eventType: K, listener: PanesManagerEventMap<N>[K]): void;
    // addEventListener<K = this extends PanesManager<infer N> ? N : string>(eventType: `change:${ K }`, listener: (this: this, event: PaneChangeEvent) => void): void;
  }
}