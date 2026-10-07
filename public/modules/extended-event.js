/**
 * @template EventMap
 * @typedef {{ trigger: <T extends keyof EventMap>(this: ControlledExtendedEventTarget<EventMap>, eventType: T, data: EventMap[T]) => void }} ControlledTargetProperties */

/**
 * @template EventMap
 * @typedef {import("./controlled-type.js").Controller<ControlledTargetProperties<EventMap>, ControlledExtendedEventTarget<EventMap>>} Controller
 */

import ControlledType from "./controlled-type.js";

/** @template D */
export class ExtendedEvent extends Event {
  /** @param {D} data */
  constructor(type, data) {
    super(type);
    this.data = data;
  }
};

/**
 * @template D
 * @extends {ExtendedEvent<D>}
*/
export class ControlledExtendedEvent extends ExtendedEvent {
  /** @param {D} data */
  constructor(type, data, isControlled = true) {
    super(type, data);
    /** Returns true if event was dispatched by the controller, and false otherwise. */
    this.isControlled = isControlled;
  }
};

/** @template EventMap */
export default class ExtendedEventTarget {

  /** @type {Map<Function, Function>} */
  #eventMap = new Map();
  #eventTarget = new EventTarget();

  /**
   * @template {keyof EventMap} T
   * @param {T} eventName
   * @param {(this: ExtendedEventTarget<EventMap>, event: ExtendedEvent<EventMap[T]>)} handler
   * @param {boolean | AddEventListenerOptions | undefined} options
   */
  on(eventName, handler, options = undefined) {
    // console.log("Set", eventName);
    this.#eventMap.set(handler, event => {
      // console.log("Call", eventName);
      if(options?.once) {
        this.#eventMap.delete(handler);
      }
      handler.call(this, event);
    });
    this.#eventTarget.addEventListener(eventName, this.#eventMap.get(handler), options);
  }

  /**
   * @template {keyof EventMap} T
   * @param {T} eventName
   * @param {(this: ExtendedEventTarget, event: ExtendedEvent<EventMap[T]>)} handler
   */
  off(eventName, handler) {
    this.#eventTarget.removeEventListener(eventName, this.#eventMap.get(handler));
    this.#eventMap.delete(handler);
  }

  /**
   * @template {keyof EventMap} T
   * @param {T} eventType
   * @param {EventMap[T]} data
   */
  trigger(eventType, data) {
    this.#eventTarget.dispatchEvent(new ExtendedEvent(eventType, data));
  }

  /**
   * @template {keyof EventMap} T
   * @template {boolean | undefined} [Rj = undefined]
   * @template {AbortController | undefined} [Ac = undefined]
   * @template {number | undefined} [To = undefined]
   * @param {T} eventType
   * @param {{ controller?: Ac; timeout?: To; rejectOnAbort?: Rj }} options
   * @returns {Promise<ExtendedEvent<EventMap[T]> | (Rj extends true ? never : (Ac extends AbortController ? null : never) | (To extends number ? null : never))>}
  */
  until(eventType, options = {}) {

    if(typeof options !== "object") {
      throw `ExtendedEventTarget.until(): 2nd argument must be an object when specified`;
    }

    if("controller" in options && options.controller instanceof AbortController === false) {
      throw `ExtendedEventTarget.until(): 2nd argument's property 'controller', must be an instance of AbortController when specified, ${ options.controller } provided`;
    }

    if("timeout" in options && !Number.isFinite(options.timeout)) {
      throw `ExtendedEventTarget.until(): 2nd argument's property 'timeout', must be a finite number when specified, ${ options.timeout } provided`;
    }

    if("rejectOnAbort" in options && typeof options.rejectOnAbort !== "boolean") {
      throw `ExtendedEventTarget.until(): 2nd argument's property 'rejectOnAbort', must be a boolean when specified, ${ options.rejectOnAbort } provided`;
    }

    return new Promise((resolve, reject) => {

      const { controller, timeout, rejectOnAbort = false } = options;
      let timeoutId;
      const listener = event => resolve(event);

      const abort = reason => {
        // remove listener from target
        this.#eventTarget.removeEventListener(eventType, listener);
        // remove listener from AbortSignal
        controller?.signal.removeEventListener("abort", abortListener);
        clearTimeout(timeoutId);
        if(rejectOnAbort === true) {
          return reject(reason);
        }
        resolve(null);
      };

      /** @type {(this: AbortSignal, event: AbortSignalEventMap["abort"]) => any} */
      function abortListener() {
        abort(this.reason);
      }

      // add listener to target
      this.#eventTarget.addEventListener(eventType, listener, { once: true });
      // add listener to AbortSignal
      controller?.signal.addEventListener("abort", abortListener);

      if(timeout !== undefined) {
        timeoutId = setTimeout(abort, timeout, "timeout");
      }

    });
  }

};

/**
 * @template EventMap
 * @extends {ControlledType<ControlledTargetProperties<EventMap>>}
*/
export class ControlledExtendedEventTarget extends ControlledType {

  /** @type {Map<(this: ExtendedEventTarget<EventMap>, event: ControlledExtendedEvent<EventMap[T]>) => any, (event: ControlledExtendedEvent<EventMap[T]>) => any>} */
  #eventMap = new Map();
  #eventTarget = new EventTarget();

  /** @param {Controller<EventMap>} controller */
  constructor(controller) {
    super({
      trigger(eventType, data) {
        this.#eventTarget.dispatchEvent(new ControlledExtendedEvent(eventType, data));
      }
    }, [ controller ]);
  }

  /**
   * @template {keyof EventMap} T
   * @param {T} eventName
   * @param {(this: ExtendedEventTarget<EventMap>, event: ControlledExtendedEvent<EventMap[T]>) => any} handler
   * @param {boolean | (AddEventListenerOptions & { controlledOnly?: boolean }) | undefined} options
   */
  on(eventName, handler, options = undefined) {
    this.#eventMap.set(handler, event => {
      if(options?.controlledOnly === true && !event.isControlled) {
        return;
      }
      if(options?.once) {
        this.#eventMap.delete(handler);
      }
      handler.call(this, event);
    });
    this.#eventTarget.addEventListener(eventName, this.#eventMap.get(handler), options);
  }

  /**
   * @template {keyof EventMap} T
   * @param {T} eventName
   * @param {(this: ExtendedEventTarget, event: ControlledExtendedEvent<EventMap[T]>)} handler
   */
  off(eventName, handler) {
    this.#eventTarget.removeEventListener(eventName, this.#eventMap.get(handler));
    this.#eventMap.delete(handler);
  }

  /**
   * @template {keyof EventMap} T
   * @param {T} eventType
   * @param {EventMap[T]} data
   */
  trigger(eventType, data) {
    this.#eventTarget.dispatchEvent(new ControlledExtendedEvent(eventType, data, false));
  }

  /** @type {new <EventMap>() => Controller<EventMap>} */
  static Controller = ControlledType.Controller;
};