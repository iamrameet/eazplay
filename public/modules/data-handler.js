/// <reference path="../../library/types.h.ts"/>

import ExtendedEventTarget from "./extended-event.js";
import { fnBind } from "./util.js";

/** @typedef {Awaited<ReturnType<import("../../library/db").View["getStructure"]>>} DataHandlerStructure */

/**
 * @template {DataHandlerStructure} T
 * @typedef {{ [K in keyof T]: T[K]["_type"] }} DataHandlerType */

/**
 * @template {DataHandlerStructure} T
 * @template {{}} [C={}]
 * @typedef {{ update: Partial<DataHandlerType<T>>; remove: DataHandlerItemWrapper<T, C>; select: { kind?: string; previous: DataHandlerItemWrapper<T, C> | null }; unselect: { kind?: string; current: DataHandlerItemWrapper<T, C> | null }; message: { [K in keyof C]: { channel: K; message: C[K] } }[keyof C] }} DataHandlerItemEventMap */

/**
 * @template {DataHandlerStructure} T
 * @template {{}} [C={}]
 * @typedef {DataHandlerType<T> & DataHandlerItem<T, C>} DataHandlerItemWrapper */

/**
 * @template {DataHandlerStructure} T
 * @template {{}} C
 * @typedef {{ add: DataHandlerItemWrapper<T, C>; remove: DataHandlerItemWrapper<T, C>; update: { item: DataHandlerItemWrapper<T, C>; fields: Partial<DataHandlerType<T>> }; select: { kind?: string; previous: DataHandlerItemWrapper<T, C> | null; current: DataHandlerItemWrapper<T, C>; }; unselect: { kind?: string; current: DataHandlerItemWrapper<T, C> | null; previous: DataHandlerItemWrapper<T, C>; }; message: { [K in keyof C]: { item: DataHandlerItemWrapper<T, C>; channel: K; message: C[K] } }[keyof C] }} DataHandlerEventMap */

/**
 * @template {DataHandlerStructure} T
 * @template {{}} [C={}]
*/
export default class DataHandler {

  #structure;
  /** @type {ExtendedEventTarget<DataHandlerEventMap<T, C>>} */
  #eventTarget = new ExtendedEventTarget();
  /** @type {{ [kind: string]: DataHandlerItemWrapper<T, C> | null }} */
  #selected = {};

  /** @param {T} structure */
  constructor(structure) {
    console.log(structure)
    this.#structure = structure;
  }

  /** @type {ExtendedEventTarget<DataHandlerEventMap<T, C>>["on"]} */
  on(...args) {
    this.#eventTarget.on(...args);
  }

  /** @type {ExtendedEventTarget<DataHandlerEventMap<T, C>>["off"]} */
  off(...args) {
    this.#eventTarget.off(...args);
  }

  /** @type {ExtendedEventTarget<DataHandlerEventMap<T, C>>["until"]} */
  until(...args) {
    return this.#eventTarget.until(...args);
  }

  /** @param {DataHandlerType<T>[]} items */
  add(...items) {
    for(const item of items) {
      const parsedItem = this.parseItem(item);
      if(parsedItem !== null) {
        this.#eventTarget.trigger("add", parsedItem);
      }
    }
  }

  /** @param {DataHandlerItemWrapper<T, C>} item */
  remove(item) {
    item.$handler = null;
    this.#eventTarget.trigger("remove", item);
    item.$self.trigger("remove", item);
  }

  /**
   * @param {DataHandlerItemWrapper<T, C>} item
   * @param {Partial<DataHandlerType<T>>} fields */
  update(item, fields) {
    const fieldsToUpdate = {};
    if(!this.#validateFieldsData(fields)) {
      return false;
    }
    for(const key in fields) {
      if(key in item && item[key] !== fields[key]) {
        fieldsToUpdate[key] = fields[key];
        item[key] = fields[key];
      }
    }
    this.#eventTarget.trigger("update", { item, fields: fieldsToUpdate });
    item.$self.trigger("update", fieldsToUpdate);
    return true;
  }

  /**
   * @template {keyof DataHandlerType<T>} K
   * @param {DataHandlerItemWrapper<T, C>} item
   * @param {K} name
   * @param {DataHandlerType<T>[K]} value
   */
  updateField(item, name, value) {
    if(!this.#validateFieldValue(name, value)) {
      return false;
    }
    if(name in item === false || item[name] === value) {
      return false;
    }
    item[name] = value;
    const fields = { [name]: value };
    this.#eventTarget.trigger("update", { item, fields });
    item.$self.trigger("update", fields);
    return true;
  }

  /**
   * @template {keyof { [K in keyof DataHandlerType<T> as DataHandlerType<T>[K] extends boolean ? K : never]: DataHandlerType<T>[K] }} K
   * @param {DataHandlerItemWrapper<T, C>} item
   * @param {K} name
   * @param {boolean} force
   */
  toggleField(item, name, force = !item[name]) {
    this.updateField(item, name, force);
    return item[name];
  }

  /**
   * @template {string} [K="default"]
   * @param {K} [kind]
   */
  getSelected(kind = "default") {
    return this.#selected[kind];
  }

  /**
   * @template {string} [K="default"]
   * @param {DataHandlerItemWrapper<T, C>} item
   * @param {K} [kind]
   */
  select(item, kind = "default") {
    const previous = this.#selected[kind];
    this.#selected[kind] = item;
    const eventData = { kind, previous, current: this.#selected[kind] };
    this.#eventTarget.trigger("select", eventData);
    item.$self.trigger("select", { kind, previous });
    this.#eventTarget.trigger("unselect", eventData);
    item.$self.trigger("unselect", { kind, current: this.#selected[kind] });
  }

  /**
   * @template {string} [K="default"]
   * @param {K} [kind]
   * @param {DataHandlerItemWrapper<T, C>} item
   */
  unselect(kind = "default", item = this.#selected[kind]) {
    if(item === this.#selected[kind]) {
      const previous = this.#selected[kind];
      this.#selected[kind] = null;
      this.#eventTarget.trigger("unselect", { kind, previous, current: null });
      item.$self.trigger("unselect", { kind, current: null });
      return true;
    }
    return false;
  }

  /**
   * @template {string} [K="default"]
   * @param {DataHandlerItemWrapper<T, C>} item
   * @param {K} [kind]
   * @param {boolean} force
   */
  toggle(item, kind = "default", force = item !== this.#selected[kind]) {
    if(force) {
      this.select(item, kind);
      return true;
    }
    this.unselect(kind, item);
    return false;
  }

  /**
   * @template {keyof C} K
   * @param {DataHandlerItemWrapper<T, C>} item
   * @param {K} channel
   * @param {C[K]} message
   */
  send(item, channel, message) {
    this.#eventTarget.trigger("message", { item, channel, message });
    item.$self.trigger("message", { channel, message });
  }

  /**
   * @template {keyof DataHandlerType<T>} K
   * @param {K} name
   * @param {DataHandlerType<T>[K]} value
   */
  #validateFieldValue(name, value) {
    if(name in this.#structure === false) {
      return true;
    }
    const isRequired = this.#structure[name].required;
    const primitiveType = this.#structure[name].primitiveType;
    if(!isRequired && value === null) {
      return true;
    }
    if(typeof value !== primitiveType) {
      console.info(`${ name } expects ${ primitiveType }, but`, value, "provided");
      return false;
    }
    return true;
  }

  /** @param {DataHandlerType<T>} fields */
  #validateFieldsData(fields) {
    for(const name in fields) {
      if(!this.#validateFieldValue(name, fields[name])) {
        return false;
      }
    }
    return true;
  }

  /** @param {DataHandlerType<T>} fields */
  parseItem(fields) {
    if(!this.#validateFieldsData(fields)) {
      return null;
    }
    return Object.assign(new DataHandlerItem(this), fields);
  }

};

/**
 * @template {DataHandlerStructure} T
 * @template {{}} [C={}]
*/
export class DataHandlerItem {

  #handler;
  #self;

  /** @param {DataHandler<T, C>} handler */
  constructor(handler) {
    this.#handler = handler;
    /** @type {ExtendedEventTarget<DataHandlerItemEventMap<T, C>>} */
    const eventTarget = new ExtendedEventTarget;
    const that = this;
    this.#self = Object.assign(eventTarget, {
      remove() {
        return that.#handler.remove(that);
      },
      /** @param {Partial<DataHandlerType<T>>} fields */
      update(fields) {
        return that.#handler.update(that, fields);
      },
      /**
       * @template {keyof DataHandlerType<T>} K
       * @param {K} name
       * @param {DataHandlerType<T>[K]} value
       */
      updateField(name, value) {
        return that.#handler.updateField(that, name, value);
      },
      /**
       * @template {keyof { [K in keyof DataHandlerType<T> as DataHandlerType<T>[K] extends boolean ? K : never]: DataHandlerType<T>[K] }} K
       * @param {K} name
       * @param {boolean} force
       */
      toggleField(name, force) {
        return that.#handler.toggleField(that, name, force);
      },
      /**
       * @template {string} [K="default"]
       * @param {K} [kind]
       */
      isSelected(kind) {
        return that.#handler.getSelected(kind) === that;
      },
      /**
       * @template {string} [K="default"]
       * @param {K} [kind]
       */
      select(kind) {
        return that.#handler.select(that, kind);
      },
      /**
       * @template {string} [K="default"]
       * @param {K} [kind]
       */
      unselect(kind) {
        return that.#handler.unselect(kind, that);
      },
      /**
       * @template {string} [K="default"]
       * @param {K} [kind]
       * @param {boolean} force
       */
      toggle(kind, force) {
        return that.#handler.toggle(that, kind, force);
      },
      /**
       * @template {keyof C} K
       * @param {K} channel
       * @param {C[K]} message
       */
      send(channel, message) {
        that.#handler.send(that, channel, message);
      }
    });
  }

  get $handler() {
    return this.#handler;
  }

  get $self() {
    return this.#self;
  }

};