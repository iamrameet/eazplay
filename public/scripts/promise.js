/// <reference path="types/global.d.ts"/>

Object.defineProperty(EventTarget.prototype, "until", {
  /** @type {(this: EventTarget, eventType: string, options?: UntilOptions) => Promise<Event>} */
  async value(eventType, options = {}) {

    return new Promise((resolve, reject) => {

      let timeoutId = null;
      const listener = event => resolve(event);
      const abort = () => {
        this.removeEventListener(eventType, listener);
        if(timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        if(options.rejectOnAbort === true) {
          return reject();
        }
        resolve();
      };

      this.addEventListener(eventType, listener, { once: true });

      if(options?.controller instanceof EventController) {
        options.controller.onabort = abort;
      }

      if(typeof options?.timeout === "number") {
        timeoutId = setTimeout(() => abort(), options.timeout);
      }

    });

  }
});

class EventController {
  onabort = null;
  abort() {
    this.onabort?.();
  }
};

class StatefulPromise extends Promise {

  static state = Object.freeze({
    FULFILLED: Symbol("fulfilled"),
    REJECTED: Symbol("rejected"),
    PENDING: Symbol("pending")
  });

  #state = StatefulPromise.state.PENDING;

  constructor(...args) {
    super(async (resolve, reject) => {
      try {
        const result = await new Promise(...args);
        this.#state = StatefulPromise.state.FULFILLED;
        resolve(result);
      } catch(reason) {
        this.#state = StatefulPromise.state.REJECTED;
        reject(reason);
      }
    });
  }

  get state() {
    return this.#state;
  }

};

/**
 * @param {number} timeout
 * @param {AbortController} controller
*/
export async function sleep(timeout, controller = null) {
  let timeoutId = null;
  return new Promise(resolve => {
    timeoutId = setTimeout(resolve, timeout);
    controller?.signal?.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      resolve();
    });
  });
}