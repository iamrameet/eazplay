import { close, createReadStream, read } from "node:fs";
import fs from "node:fs/promises";
import Logger from "./logger.js";
import AsyncQueue from "./async-queue.js";
import Type, { Types } from "./types.js";
import NodePath from "node:path";
import { construct } from "../common/util.js";

export const DBTypes = {
  ID: class ID extends Types.String {
    static [Type.SIZE] = 16;
  }
};

/** @template {string} [K=string] */
class StorageStructure {

  #indexedFields;

  /** @param {{ [field in K]: { index: number; primitiveType: PrimitiveTypeNames; size: number; unique?: boolean; } }} fields */
  constructor(fields = {}, length = 0) {

    this.fields = Object.freeze(fields);
    this.length = length ?? 0;

    /** @type {K[]} */
    const orderOfFields = [];
    for(const [fieldName, field] of Object.entries(this.fields)) {
      orderOfFields[field.index] = fieldName;
    }
    this.#indexedFields = Object.freeze(orderOfFields);

  }

  get indices() {
    return Array.from(Object.entries(this.fields)).filter(field => field[1].unique);
  }

  get order() {
    return this.#indexedFields;
  }

  /** @param {string} rawString */
  parse(rawString) {
    /** @type {{ [N in K]: PrimitiveTypes }} */
    const object = {};
    for(const fieldName of this.order) {
      const field = this.fields[fieldName];
      const value = rawString.slice(0, field.size).trim();
      switch(field.primitiveType) {
        case "string":
          object[fieldName] = value;
        break;
        case "number":
          object[fieldName] = Number(value);
        break;
        case "bigint":
          object[fieldName] = BigInt(value);
        break;
        case "boolean":
          object[fieldName] = Boolean(Number(value));
        break;
        case "symbol":
          object[fieldName] = Symbol(value);
        break;
        case "object":
          object[fieldName] = JSON.parse(value);
        break;
      }
      rawString = rawString.slice(field.size);
    }
    return object;
  }

  stringify(manageable) {}

};

class StorageIndices {
  /** @param {{ [rowId: string]: number }} data */
  constructor(data = {}) {
    this.data = data;
  }
};

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
  #size;

  /** @param {{ type: T; unique?: boolean; required?: R | false; reassignable?: boolean; size?: number; defaultValue?: () => Generator<Parameters<T["from"]>[0]> }} options */
  constructor(options = {}) {

    if(options?.type.prototype === Type) {
      throw `'type' option expects a Type type, '${ options.type }' provided`;
    }

    if("size" in options && typeof options.size !== "number") {
      throw "'size' option expects a number value when specified";
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
    this.#size = options.size ?? this.#type.size;
    this.#unique = options.unique ?? false;
    this.#required = options.required ?? false;
    this.#reassignable = options.reassignable ?? true;
  }

  get type() {
    return this.#type;
  }
  get size() {
    return this.#size;
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
  /** @type {number} */
  #size;

  /** @param {T} fields */
  constructor(fields) {
    this.#fields = Object.freeze(fields);
    this.#size = Object.values(this.#fields).reduce((sum, field) => sum + field.size, 0);
    /** @type {{ [K in keyof T]: T[K] & { isRequired: true } }} */
    this.requiredFields = Object.freeze(Object.fromEntries(Array.from(Object.entries(this.#fields)).filter(entry => entry[1].isRequired)));
  }

  get fields() {
    return this.#fields;
  }

  get size() {
    return this.#size;
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
        const resultValue = JSON.stringify(result[fieldName].toJSON());
        const charactersCount = resultValue.length;
        if(charactersCount > field.size) {
          throw new Error(`field '${ fieldName }' value size (${ field.size }) exceeded, provided value '${ resultValue }' (${ charactersCount })`);
        }
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

  #directoryPath;
  #type;
  #logger;
  #requestQueue = new AsyncQueue();
  #storage = {
    /** @type {fs.FileHandle} */
    file: null,
    /** @type {StorageStructure<keyof T["structure"]["fields"]>} */
    structure: {},
    /** @type {Map<string, StorageIndices>} */
    indices: new Map()
  };

  /**
   * @param {string} directoryPath
   * @param {T} type
   * @param {{ logger?: Logger }} options
  */
  constructor(directoryPath, type, options = {}) {
    this.#type = type;
    this.#directoryPath = NodePath.join(directoryPath);
    this.#logger = options.logger ?? new Logger(`${ new.target.name }<${ type.name }>`);
  }

  get type() {
    return this.#type;
  }

  getStructurePath() {
    return NodePath.join(this.#directoryPath, "structure.json");
  }
  /** @param {T} fieldName */
  getIndexPath(fieldName = "id") {
    return NodePath.join(this.#directoryPath, `index-${ fieldName }.json`);
  }
  getDataPath() {
    return NodePath.join(this.#directoryPath, "data.txt");
  }

  /**
   * @param {InstanceType<T>} manageable
   * @return {Promise<InstanceType<T>>}
   */
  async #add(manageable) {
    const array = [];
    for(const [fieldName, field] of Object.entries(this.#storage.structure.fields)) {
      const isObject = this.#type.structure.fields[fieldName].type.primitiveType === "object";
      const value = manageable.get(fieldName).value;
      if(field.unique && value in this.#storage.indices.get(fieldName).data) {
        throw new Error(`An entry with ${ fieldName } = ${ value } already exists.`);
      }
      const stringifiedValue = isObject ? manageable.get(fieldName).toJSON() : value.toString();
      const emptySpace = field.size - stringifiedValue.length;
      array[field.index] = stringifiedValue + construct(Array, emptySpace).fill(" ").join("");
    }
    const rowIndex = this.#storage.structure.length++;
    for(const [fieldName, storageIndex] of this.#storage.indices) {
      storageIndex.data[manageable.get(fieldName).value] = rowIndex;
    }
    return await this.#requestQueue.enqueuePromise(async () => {
      await this.saveStructureFile();
      await this.saveIndexFiles();
      await fs.appendFile(this.getDataPath(), array.join(""), { encoding: "utf-8" });
      return manageable;
    }, "ADD");
  }

  /**
   * @param {InstanceType<T>} manageable
   * @return {Promise<InstanceType<T>>}
   */
  async add(manageable) {
    if(manageable instanceof this.#type === false) {
      throw new TypeError(`'${ manageable }' is not an instance of '${ this.#type.name }'`);
    }
    return await this.#add(manageable);
  }

  /**
   * @param {ConstructorParameters<T>} args
   * @return {Promise<InstanceType<T>>}
   */
  async emplace(...args) {
    const manageable = new this.#type(...args);
    return await this.#add(manageable);
  }

  async getById(id) {
    const indexData = this.#storage.indices.get("id").data;
    if(id in indexData === false) {
      return null;
    }
    return await this.#readAtIndex(indexData[id]);
  }

  /** Sequential find
   * @param {(manageable: InstanceType<T>) => Promise<boolean>} predicate
   */
  async findFirst(predicate) {
    let index = 0;
    let limitPerFetch = 10;
    return await this.#requestQueue.enqueuePromise(async () => {
      while(true) {
        const manageables = await this.#readAtIndexRange(index, index + limitPerFetch);
        for(const manageable of manageables) {
          if(await predicate(manageable)) {
            return manageable;
          }
        }
        index += limitPerFetch;
        if(manageables.length < limitPerFetch) {
          return null;
        }
      }
    });
  }

  /** Sequential find
   * @param {(manageable: InstanceType<T>) => Promise<boolean>} predicate
   * @returns {Promise<InstanceType<T>[]>}
   */
  async findAll(predicate) {
    let index = 0;
    let limitPerFetch = 10;
    return await this.#requestQueue.enqueuePromise(async () => {
      const result = [];
      while(true) {
        const manageables = await this.#readAtIndexRange(index, index + limitPerFetch);
        for(const manageable of manageables) {
          if(await predicate(manageable)) {
            result.push(manageable);
          }
        }
        index += limitPerFetch;
        if(manageables.length < limitPerFetch) {
          break;
        }
      }
      return result;
    });
  }

  /** @param {number} index */
  async #readAtIndex(index) {
    const position = {
      start: index * this.#type.structure.size,
      end: (index + 1) * this.#type.structure.size
    };
    const buffer = Buffer.alloc(position.end, position.start);
    const fileReadResult = await this.#storage.file.read(buffer, 0, buffer.length, position.start);
    let rawString = fileReadResult.buffer.toString("utf-8");
    const object = this.#storage.structure.parse(rawString);
    return new this.#type(object);
  }

  /**
   * @param {number} start
   * @param {number} end
  */
  async #readAtIndexRange(start, end) {
    if(this.#storage.structure.length === 0) {
      return [];
    }
    if(end >= this.#storage.structure.length) {
      end = this.#storage.structure.length;
    }
    if(start >= end) {
      return [];
    }
    const structureSize = this.#type.structure.size
    const position = {
      start: start * structureSize,
      end: end * structureSize
    };
    const buffer = Buffer.alloc(position.end, position.start);
    this.#storage.file = await fs.open(this.getDataPath(), "r");
    const fileReadResult = await this.#storage.file.read(buffer, 0, buffer.length, position.start);
    let rawString = fileReadResult.buffer.toString("utf-8");
    const manageables = [];
    const size = end - start;
    for(let i = 0; i < size; i++) {
      if(rawString.length === 0) {
        break;
      }
      const startIndex = structureSize * i;
      const nextIndex = structureSize * (i + 1);
      const rowRawString = rawString.slice(startIndex, nextIndex);
      const object = this.#storage.structure.parse(rowRawString);
      manageables.push(new this.#type(object));
    }
    return manageables;
  }

  /** @param {keyof T["structure"]["fields"]} fieldName */
  async indexing(fieldName) {}

  async #createDir() {
    await fs.mkdir(this.#directoryPath, { recursive: true });
  }

  async #readFile(filepath, defaultContent = "") {
    try {
      const fileContent = await fs.open(filepath);
      try {
        return fileContent;
      } catch(ex) {
        this.#logger.log(ex?.message ?? ex);
        return {};
      }
    } catch(ex) {
      switch(ex?.errno) {
        case -4058:
          await fs.writeFile(filepath, defaultContent, { encoding: "utf-8" });
          return {};
        default: throw ex;
      }
    }
  }

  /**
   * @param {string} filepath
   * @returns {Promise<{}>}
  */
  async #readFileAsJSON(filepath) {
    try {
      const fileContent = await fs.readFile(filepath, { encoding: "utf-8" });
      try {
        return JSON.parse(fileContent);
      } catch(ex) {
        this.#logger.log(ex?.message ?? ex);
        return {};
      }
    } catch(ex) {
      switch(ex?.errno) {
        case -4058:
          await fs.writeFile(filepath, "{}", { encoding: "utf-8" });
          return {};
        default: throw ex;
      }
    }
  }

  /**
   * @param {StorageStructure["fields"]} oldStructure
   * @param {StorageStructure["fields"]} newStructure
   */
  async #migrateData(oldStructure, newStructure) {
    this.#readAtIndex(0);
  }

  /**
   * @deprecated
   * @param {T["structure"]["fields"]} structureFields
   * @param {StorageStructure["fields"]} storageFields
   */
  async #findDifference(structureFields, storageFields) {
    /** @type {{ [K: string]: { status: "unchanged" | "added" | "removed" } | { status: "modified"; size: [ oldSize: number, newSize: number ] } }} */
    const fieldsStatus = {};
    for(const [fieldName, field] of Object.entries(structureFields)) {
      if(fieldName in storageFields) {
        const isSizeChanged = field.type.size !== storageFields[fieldName].size;
        fieldsStatus[fieldName] = {};
        fieldsStatus[fieldName].size = [ storageFields[fieldName].size, field.type.size ];
        fieldsStatus[fieldName].status = isSizeChanged ? "modified" : "unchanged";
        continue;
      }
      fieldsStatus[fieldName] = { status: "added" };
    }
    for(const fieldName in storageFields) {
      if(fieldName in fieldsStatus === false) {
        fieldsStatus[fieldName] = { status: "removed" };
      }
    }
    return fieldsStatus;
  }

  /** @returns a boolean represent whether the data needs to be migrated */
  async #LoadStructureData() {
    const structurePath = this.getStructurePath();
    /** @type {StorageStructure} */
    const structureFileData = await this.#readFileAsJSON(structurePath);
    const typeStructureFields = this.#type.structure.fields;
    if("fields" in structureFileData === false) {
      structureFileData.fields = {};
      // throw new Error("fields are already declared");
    }
    const modifiedFields = [];
    for(const [fieldIndex, fieldName] of Object.keys(typeStructureFields).entries()) {
      if(fieldName in structureFileData.fields) {
        const isSizeChanged = structureFileData.fields[fieldName].size !== typeStructureFields[fieldName].size;
        const isIndexChanged = structureFileData.fields[fieldName].index !== fieldIndex;
        const properties = [];
        if(isIndexChanged) {
          properties.push("index");
        }
        if(isSizeChanged) {
          properties.push("size");
        }
        if(properties.length === 0) {
          continue;
        }
        modifiedFields.push({ fieldName, properties });
      }
      structureFileData.fields[fieldName] = {
        index: fieldIndex,
        unique: typeStructureFields[fieldName].isUnique,
        primitiveType: typeStructureFields[fieldName].type.primitiveType,
        size: typeStructureFields[fieldName].size
      };
    }
    this.#storage.structure = new StorageStructure(structureFileData.fields, structureFileData.length);
    if(modifiedFields.length > 0) {
      await this.saveStructureFile();
    }
    return modifiedFields;
  }

  async #load() {
    try {
      const modifiedFields = await this.#LoadStructureData();
      if(modifiedFields.length > 0) {
        await this.reset();
        this.#logger.error(`structure modified ${
          modifiedFields.map(field => `${ field.fieldName }: ${ field.properties.join(", ") }`)
        }`);
      }
      for(const [fieldName] of this.#storage.structure.indices) {
        const indexPath = this.getIndexPath(fieldName);
        const indexFileData = await this.#readFileAsJSON(indexPath);
        this.#storage.indices.set(fieldName, new StorageIndices(indexFileData));
      }
      // this.#storage.file = await fs.open(this.getDataPath(), "r");
    } catch(ex) {
      this.#logger.error("LOAD", ex);
    }
  }

  async load() {
    // this.#throwIfNotOpen();
    await this.#createDir();
    await this.#load();
  }

  /**
   * @param {string} path
   * @param {{}} data
   */
  async #saveFileAsJSON(path, data) {
    try {
      await fs.writeFile(path, JSON.stringify(data), { encoding: "utf-8" });
      return true;
    } catch(ex) {
      this.#logger.log(ex);
      return false;
    }
  }

  /** @returns {Promise<Manager<T>>} */
  async save() {
    await this.saveStructureFile();
    await this.saveIndexFiles();
  }

  async saveStructureFile() {
    await this.#saveFileAsJSON(this.getStructurePath(), this.#storage.structure);
  }

  /** @param {T} fieldName */
  async saveIndexFile(fieldName) {
    const indexPath = this.getIndexPath(fieldName);
    await this.#saveFileAsJSON(indexPath, this.#storage.indices.get(fieldName).data);
  }

  async saveIndexFiles() {
    for(const [fieldName] of this.#storage.structure.indices) {
      await this.saveIndexFile(fieldName);
    }
  }

  async reset() {
    await this.save();
  }

  generateId(){
    return Date.now().toString(36);
  }

  stringify() {
    const data = Object.fromEntries([]);
    for(const id in data){
      data[id] = data[id].toObject();
    }
    return JSON.stringify(data);
  }
};