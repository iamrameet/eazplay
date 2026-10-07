import fs from "node:fs/promises";
import Logger from "./logger.js";
import AsyncQueue from "./async-queue.js";
import Type, { Types } from "./types.js";

export { Types };

/**
 * @template {ReturnType<typeof Type.new>} [T = ReturnType<typeof Type.new>]
 * @template {boolean} R
 */
export class Field {

  #type;
  #defaultValue;
  #unique;
  #required;
  #reassignable;

  /** @param {{ type: T; unique?: boolean; required?: R | false; reassignable?: boolean; defaultValue?: () => Generator<Parameters<T["from"]>[0]> }} options */
  constructor(options = {}) {

    if(options?.type.prototype === Type) {
      throw `'type' option expects a Type type, '${ options.type }' provided`;
    }

    if("unique" in options && typeof options.unique !== "boolean") {
      throw "'unique' option expects a boolean value when specified";
    }

    if("required" in options && typeof options.required !== "boolean") {
      throw "'required' option expects a boolean value when specified";
    }

    if("reassignable" in options && typeof options.reassignable !== "boolean") {
      throw "'reassignable' option expects a boolean value when specified";
    }

    if("defaultValue" in options && typeof options.defaultValue === "function") {
      this.#defaultValue = options.defaultValue;
    }

    this.#type = options.type;
    this.#unique = options.unique ?? false;
    this.#required = options.required ?? false;
    this.#reassignable = options.reassignable ?? true;
  }

  get type() {
    return this.#type;
  }
  get isUnique() {
    return this.#unique;
  }
  get isRequired() {
    return this.#required;
  }
  get isReassignable() {
    return this.#reassignable;
  }
  get defaultValue() {
    const value = this.#defaultValue?.().next().value ?? undefined;
    return this.#type.from(value);
  }

};

/**
 * @template {Readonly} R
 * @typedef {R extends Readonly<infer T> ? T : never} InferReadonly
*/

/** @template {Readonly<{ [field: string]: Field }>} [T=Readonly<{ [field: string]: Field }>] */
export class Structure {

  #fields;

  /** @param {T} fields */
  constructor(fields) {
    this.#fields = Object.freeze(fields);
    /** @type {{ [K in keyof T]: T[K] & { isRequired: true } }} */
    this.requiredFields = Object.freeze(Object.fromEntries(Array.from(Object.entries(this.#fields)).filter(entry => entry[1].isRequired)));
  }

  get fields() {
    return this.#fields;
  }

  /** @returns {Generator<[fieldName: keyof T, T[fieldName]]>} */
  *[Symbol.iterator]() {
    for(const entry of Object.entries(this.#fields)) {
      yield entry;
    }
  }

  /** @param {{ [K in keyof T]: InstanceType<T[K]["type"]> | ConstructorParameters<T[K]["type"]>[0] }} object */
  validate(object) {
    /** @type {{ [K in keyof T]: InstanceType<T[K]["type"]> }} */
    const result = {};
    for(const [ fieldName, field ] of this) {
      const value = (fieldName in object === false ? field.defaultValue : object[fieldName]) ?? undefined;
      if(field.isRequired && value === undefined) {
        throw new Error(`field '${ fieldName }' is required`);
      }
      if(value !== undefined) {
        result[fieldName] = field.type.from(value);
      }
    }
    return result;
  }

  /** @returns {{ [K in keyof T]: [ T[K]["type"]["name"], T[K]["type"]["primitiveType"], InstanceType<T[K]["type"]>["value"] ] }} */
  objectify() {
    const object = {};
    for(const fieldName in this.#fields) {
      const field = this.#fields[fieldName];
      object[fieldName] = [ field.type.name, field.type.primitiveType ];
    }
    return object;
  }

};

/** @typedef {{ id: Field<typeof Types.String, true>; createdAt: Field<typeof Types.DateTime, true>; updatedAt: Field<typeof Types.DateTime, true>; }} ManageableFields */
/**
 * @template {Readonly<{ [field: string]: Field<import("./types.js").ExtendedType, boolean> }>} T
 * @typedef {T & ManageableFields} IncludeManageableFields */

export class Manageable {

  /**
   * @template {Readonly<{ [field: string]: Field<import("./types.js").ExtendedType, boolean> }>} T
   * @param {T | Structure<T>} structure
  */
  static new(structure) {

    return class Manageable extends this {

      static #structure = new Structure({
        ...structure instanceof Structure ? structure.fields : structure,
        id: new Field({ type: Types.String, required: true, reassignable: false, unique: true }),
        createdAt: new Field({ type: Types.DateTime, required: true, reassignable: false }),
        updatedAt: new Field({ type: Types.DateTime, required: true })
      });
      static FROM = Symbol();
      static #count = 0;

      #fieldValues;

      /** @param {{ [K in keyof IncludeManageableFields<T>]: IncludeManageableFields<T>[K] extends Field<infer X, infer R> ? (R extends true ? InstanceType<IncludeManageableFields<T>[K]["type"]>["value"] : InstanceType<IncludeManageableFields<T>[K]["type"]>["value"] | undefined) : never }} object */
      constructor(object) {
        object = { ...object };
        if("id" in object === false) {
          object.id = Manageable.createId();
        }
        if("createdAt" in object === false) {
          object.createdAt = Types.DateTime.defaultValue;
        }
        if("updatedAt" in object === false) {
          object.updatedAt = Types.DateTime.defaultValue;
        }
        super();
        this.#fieldValues = Manageable.#structure.validate(object);
      }

      static get structure() {
        return Manageable.#structure;
      }

      /** @param {keyof IncludeManageableFields<T>} field */
      has(field) {
        return field in this.#fieldValues;
      }

      /**
       * @template {keyof IncludeManageableFields<T>} K
       * @param {K} field
       */
      get(field) {
        return this.#fieldValues[field];
      }

      /**
       * @template {keyof IncludeManageableFields<T>} K
       * @param {K} field
       * @param {IncludeManageableFields<T>[K]} value
       */
      set(field, value) {
        this.#fieldValues[field].value = value;
      }

      /** @returns {{ [K in keyof IncludeManageableFields<T>]: InstanceType<IncludeManageableFields<T>[K]["type"]>["value"] }} */
      toObject() {
        return Object.fromEntries(Object.entries(this.#fieldValues).map(entry => [entry[0], entry[1].value]));
      }

      static createId() {
        return (Date.now() + "" + (Manageable.#count++)).toString(36);
      }

    };

  }
};


/**
 * @template {ReturnType<typeof Manageable.new>} T */
export default class Manager {

  #filepath;
  #type;
  #logger;
  /** @type {Map<string, InstanceType<T>>} */
  #data = new Map();
  #requestQueue = new AsyncQueue();

  /**
   * @param {string} filepath
   * @param {T} type
   * @param {{ logger?: Logger }} options
  */
  constructor(filepath, type, options = {}) {
    this.#type = type;
    this.#filepath = filepath;
    this.#logger = options.logger ?? new Logger(`${ new.target.name }<${ type.name }>`);
  }

  get type() {
    return this.#type;
  }

  async #createDir() {
    const dirPath = path.dirname(this.#filepath);
    return await fs.mkdir(dirPath, { recursive: true });
  }

  /** @param {string} id */
  has(id) {
    return this.#data.has(id);
  }

  /** @param {string} id */
  get(id) {
    if(this.#data.has(id)) {
      return this.#data.get(id);
    }
  }

  /** @param {{[id in keyof ReturnType<InstanceType<T>["toObject"]>]?: ReturnType<InstanceType<T>["toObject"]>[id]}} object */
  find(object) {
    for(const manageable of this.#data.values()) {
      let found = manageable;
      for(const fieldName in object) {
        if(manageable.has(fieldName) || !manageable.get(fieldName).match(object[fieldName])){
          found = null;
          break;
        }
      }
      if(found !== null){
        return found;
      }
    }
    return null;
  }

  /** @param {{[id in keyof ReturnType<InstanceType<T>["toObject"]>]?: ReturnType<InstanceType<T>["toObject"]>[id]}} object */
  any(object) {
    for(const manageable of this.#data.values()) {
      for(const fieldName in object) {
        if(manageable.get(fieldName)?.match(object[fieldName]))
          return manageable;
      }
    }
    return null;
  }

  /** @param {{[id in keyof ReturnType<InstanceType<T>["toObject"]>]?: ReturnType<InstanceType<T>["toObject"]>[id]}} object */
  *every(object) {
    for(const manageable of this.#data.values()) {
      for(const fieldName in object) {
        if(manageable.get(fieldName)?.match(object[fieldName]))
          yield manageable;
      }
    }
    return false;
  }

  /**
   * @param {InstanceType<T>} object
   * @return {Promise<InstanceType<T>>}
   */
  async add(object) {
    return await new Promise((resolve, reject) => {
      this.#requestQueue.enqueue(async () => {
        try {
          if(object instanceof this.#type === false) {
            throw new TypeError(`'${ object }' is not an instance of '${ this.#type.name }'`);
          }
          this.#data.set(object.get("id").value, object);
          await this.save();
          return void resolve(object);
        } catch(ex) {
          return void reject(ex);
        }
      }, "ADD");
    });
  }

  /**
   * @param {ConstructorParameters<T>} args
   * @return {Promise<InstanceType<T>>}
   */
  async emplace(...args) {
    return await new Promise((resolve, reject) => {
      this.#requestQueue.enqueue(async () => {
        try {
          const manageable = new this.#type(...args);
          this.#data.set(manageable.get("id").value, manageable);
          await this.save();
          return void resolve(manageable);
        } catch(ex) {
          return void reject(ex);
        }
      }, "ADD");
    });
  }

  /**
   * @param {ConstructorParameters<T>} args
   * @return {Promise<InstanceType<T>>}
   */
  async set(id, ...args) {
    return await new Promise((resolve, reject) => {
      this.#requestQueue.enqueue(async () => {
        try {
          let manageable = this.#data.get(id);
          if(manageable === undefined) {
            manageable = new this.#type(...args);
          } else {
            for(const key in args[0]) {
              if(manageable.has(key)) {
                manageable.get(key).value = args[0][key];
              }
            }
            manageable.get("updatedAt").value = Types.DateTime.defaultValue;
          }
          this.#data.set(id, manageable);
          await this.save();
          return void resolve(manageable);
        } catch(ex) {
          return void reject(ex);
        }
      }, "ADD");
    });
  }

  /**
   * @param {string} id
   * @param {InstanceType<T> | (item: InstanceType<T>) => InstanceType<T> | void} object
   * @return {Promise<InstanceType<T>>}
   */
  async updateById(id, object) {
    return await new Promise((resolve, reject) => {
      this.#requestQueue.enqueue(async () => {
        if(!this.#data.has(id)) {
          return void reject(`No data exist for given Id '${ id  }'`);
        }
        try {
          /** @type {InstanceType<T>} */
          let instance;
          if(typeof object === "function") {
            const item = this.#data.get(id);
            const predicateResult = object(item);
            instance = predicateResult instanceof this.#type ? predicateResult : item;
          } else if(object instanceof this.#type) {
            instance = object;
          } else {
            throw new TypeError(`'${ object }' is neither an instance of '${ this.#type.name }' nor a predicate function`);
          }
          instance.get("updatedAt").value = Types.DateTime.defaultValue;
          this.#data.set(id, instance);
          await this.save();
          return void resolve(instance);
        } catch(ex) {
          return void reject(ex);
        }
      }, "UPDATE");
    });
  }

  async #load() {
    try {
      const fileContent = await fs.readFile(this.#filepath, { encoding: "utf-8" });
      this.#data = this.#filterData(JSON.parse(fileContent));
    } catch(ex) {
      this.#logger.error("LOAD", ex);
    }
  }

  async load() {
    // this.#throwIfNotOpen();
    const fileStat = await fs.stat(this.#filepath).catch(console.log);
    if(fileStat) {
      return void await this.#load();
    }
    await this.save();
  }

  /** @returns {Promise<Manager<T>>} */
  async save() {
    return new Promise(async resolve => {
      try {
        await fs.writeFile(this.#filepath, this.stringify(), { encoding: "utf-8" });
        resolve(this);
      } catch(ex) {
        this.#logger.log(ex);
        resolve(Manager.#defaultData());
      }
    });
  }

  async reset() {
    this.#data.clear();
    await this.save();
  }

  generateId(){
    return Date.now().toString(36);
  }

  /** @param {Object<string, InstanceType<T>>} data */
  #filterData(data) {
    const objectMap = Manager.#defaultData();
    if(data && typeof data === "object") {
      for(const [id, object_like] of Object.entries(data)){
        const object = new this.#type({ ...object_like, id });
        if(object !== null){
          objectMap.set(id, object);
        }
      }
    }
    return objectMap;
  }

  /** @returns {Generator<[id: string, ReturnType<InstanceType<T>["toObject"]>]>} */
  *entries() {
    for(const [key, value] of this.#data.entries()) {
      yield [key, value.toObject()];
    };
  }

  /** @returns {Generator<ReturnType<InstanceType<T>["toObject"]>>} */
  *values() {
    for(const value of this.#data.values()) {
      yield value.toObject();
    };
  }

  *ids() {
    for(const keys of this.#data.keys()) {
      yield keys;
    };
  }

  stringify() {
    const data = Object.fromEntries(this.#data);
    for(const id in data){
      data[id] = data[id].toObject();
    }
    return JSON.stringify(data);
  }

  static #defaultData() {
    return new Map();
  }

};