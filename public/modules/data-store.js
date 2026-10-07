import DataHandler from "./data-handler.js";
import ExtendedEventTarget, { ExtendedEvent } from "./extended-event.js";

/**
 * @template {{}} T
 * @typedef {{ set: { requestItem: (ref: any) => T; scope: (ref: any, callbackfn: (item: T) => void) => T; type: "set" | "update" }; delete: T; update: { requestItem: (ref: any) => T; scope: DataStoreEventsMap<T>["update"]["scope"]; fields: Partial<T> } }} DataStoreEventsMap
 */

/**
 * @template {DataHandler} T
 * @template {keyof Parameters<T["add"]>[0]} K
 */
export default class DataStore {

  /** @type {Map<K, { references: Set<any>; item: ReturnType<T["parseItem"]> }>} */
  #data = new Map;
  /** @type {ExtendedEventTarget<DataStoreEventsMap<ReturnType<T["parseItem"]>>>} */
  #eventTarget = new ExtendedEventTarget;
  #dataHandler;
  #key;

  /**
   * @param {T} dataHandler
   * @param {K} key
   * @param {{ update: (this: DataStore<T, K>, setter: DataStore<T, K>["updateItem"]) => any }} internals
   */
  constructor(dataHandler, key, internals) {
    this.#dataHandler = dataHandler;
    this.#key = key;
    internals?.update?.((key, fieldsValue) => this.#updateItemAs(key, fieldsValue, true));
  }

  /** @param {Parameters<T["add"]>[0][K]} key */
  hasItem(key) {
    return this.#data.has(key);
  }

  /** @param {Parameters<T["add"]>[0]} item */
  setItem(item) {
    const key = item[this.#key];
    const requestItem = ref => this.requestItem(ref, key);
    const scope = (ref, callbackfn) => this.scope(ref, key, callbackfn);
    if(this.#data.has(key)) {
      this.#eventTarget.trigger("set", { requestItem, scope, type: "update" });
      return false;
    }
    this.#data.set(key, {
      references: new Set(),
      item: this.#dataHandler.parseItem(item)
    });
    this.#eventTarget.trigger("set", { requestItem, scope, type: "set" });
    return true;
  }

  /**
   * @param {Parameters<T["add"]>[0][K]} key
   * @param {Partial<Parameters<T["add"]>[0]>} fieldsValue
   */
  #updateItemAs(key, fieldsValue, internal = false) {
    const item = this.#data.get(key);
    if(item === undefined) {
      return false;
    }
    const updated = item.item.$self.update(fieldsValue);
    if(!updated) {
      return false;
    }
    if(!internal) {
      this.#eventTarget.trigger("update", {
        requestItem: ref => this.requestItem(ref, key),
        scope: (ref, callbackfn) => this.scope(ref, key, callbackfn),
        fields: fieldsValue
      });
    }
    return true;
  }

  /**
   * @param {Parameters<T["add"]>[0][K]} key
   * @param {Partial<Parameters<T["add"]>[0]>} fieldsValue
   */
  updateItem(key, fieldsValue) {
    return this.#updateItemAs(key, fieldsValue);
  }

  /** @param {Parameters<T["add"]>[0][K]} key */
  requestItem(ref, key) {
    const item = this.#data.get(key);
    if(item === undefined) {
      return null;
    }
    item.references.add(ref);
    return item.item;
  }

  /** @param {Parameters<T["add"]>[0][K]} key */
  releaseItem(ref, key) {
    const item = this.#data.get(key);
    if(item === undefined) {
      return false;
    }
    item.references.delete(ref);
    if(item.references.size === 0) {
      this.#data.delete(key);
    }
    this.#eventTarget.trigger("delete", item.item);
    return true;
  }

  /**
   * @template {keyof DataStoreEventsMap<ReturnType<T["parseItem"]>>} E
   * @param {E} eventType
   * @param {(event: ExtendedEvent<DataStoreEventsMap<ReturnType<T["parseItem"]>>[E]>) => any} handler
   */
  on(eventType, handler) {
    this.#eventTarget.on(eventType, handler);
  }

  /**
   * @template {keyof DataStoreEventsMap<ReturnType<T["parseItem"]>>} E
   * @param {E} eventType
   * @param {(event: ExtendedEvent<DataStoreEventsMap<ReturnType<T["parseItem"]>>[E]>) => any} handler
   */
  off(eventType, handler) {
    this.#eventTarget.on(eventType, handler);
  }

  /**
   * @template {(...args: any) => Promise<any>}
   * @param {any} ref
   * @param {Parameters<T["add"]>[0][K]} key
   * @param {F} callbackfn
  */
  async scope(ref, key, callbackfn) {
    const item = this.requestItem(ref, key);
    await callbackfn(item);
    this.releaseItem(ref, key);
  }

};