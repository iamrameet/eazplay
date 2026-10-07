/// <reference path="./types.h.ts"/>

import { construct } from "../common/util.js";
/**
 * @template {PrimitiveTypeNames} [K=PrimitiveTypeNames]
 * @template {PrimitiveTypeMap[K]} [V=PrimitiveTypeMap[K]]
 * @typedef {ReturnType<typeof Type.new<K, V>>} ExtendedType
 */

/**
 * @template {() => Generator} T
 * @typedef {ReturnType<T> extends Generator<infer Y> ? Y : never} GeneratorFunctionYield
*/

/**
 * @template {ReturnType<typeof Type.new>} T
 * @typedef {PrimitiveTypeMap[T extends ExtendedType<"object", infer V> ? V : T["primitiveType"]]} ValueType
*/

export default class Type {

  /** @readonly */
  static JSON = Symbol();
  /** @readonly */
  static SIZE = Symbol();
  /** @readonly */
  static ["=="] = Symbol();

  /**
   * @template {PrimitiveTypeNames} [K=PrimitiveTypeNames]
   * @template {PrimitiveTypeMap[K]} [V=PrimitiveTypeMap[K]]
   * @param {K} primitiveType
   * @param {() => Generator<V>} defaultValue
   * @param {number} [size]
   */
  static new(primitiveType, defaultValue, size) {

    return class Type extends this {

      static primitiveType = primitiveType;
      static defaultValueGenerator = defaultValue();
      static defaultSize = size ?? 128;

      /** @returns {V} */
      static get defaultValue() {
        return this.defaultValueGenerator.next().value;
      }

      /** @returns {number} */
      static get size() {
        return this[Type.SIZE] ?? this.defaultSize;
      }

      #value;

      /** @param {K extends "object" ? V : PrimitiveTypeMap[K]} [value] */
      constructor(value = new.target.defaultValue) {
        super();
        this.value = value;
      }

      /** @returns {K extends "object" ? V : PrimitiveTypeMap[K]} */
      get value() {
        return this.#value;
      }

      set value(value) {
        this.#value = Type.#isTypeOf(value) ? value : undefined;
        // if((typeof value === "object" ? JSON.stringify(value) : value.toString()).length > Type.size) {
        //   throw new Error(`value ${  } can not be saved`);
        // }
      }

      [Symbol.toPrimitive]() {
        let value = String(this.#value);
        if(value.length > Type.size) {
          value = value.slice(0, Type.size);
        }
        return value;
      }

      get [Symbol.toStringTag]() {
        return this.#value;
      }

      /**
       * @param {this | V} value
       * @returns {this[typeof Type["=="]] extends (value: this | V) => boolean ? O : never} */
      match(value) {
        return (this[Type["=="]]?.(value)) ?? this.#value === (value instanceof Type ? value.#value : value);
      }

      /** @returns {this[typeof Type.JSON] extends (...args: []) => infer R ? R : V} */
      toJSON() {
        return this[Type.JSON]?.() ?? this.#value;
      }

      static #isTypeOf(value) {
        return this.primitiveType === typeof value;
      }

      /** @type {<T extends ExtendedType<K, V>>(this: T, value: InstanceType<T> | T["defaultValue"]) => InstanceType<T>} */
      static from(value) {
        return new this(value instanceof this ? value.#value : value);
      }

    };

  }

};

export class Types {

  static String;
  static Number;
  static Boolean;
  static Int;
  static Float;
  static DateTime;

  static Array;
  static Object;
  static Set;

  static *#stringGenerator() {
    while(true) yield /** @type {const} */ ("");
  }
  static *#numberGenerator() {
    while(true) yield /** @type {const} */ (0);
  }
  static *#booleanGenerator() {
    while(true) yield /** @type {const} */ (false);
  }
  static *#dateTimeGenerator() {
    while(true) yield construct(Date).toISOString();
  }

  static {

    this.String = class String extends Type.new("string", this.#stringGenerator) {
      get value() {
        return super.value;
      }
      set value(value) {
        super.value = globalThis.String(value);
      }
    };

    this.Number = class Number extends Type.new("number", this.#numberGenerator) {
      get value() {
        return super.value;
      }
      set value(value) {
        super.value = globalThis.Number(value);
      }
    };

    this.Boolean = class Boolean extends Type.new("boolean", this.#booleanGenerator, 1) {
      get value() {
        return super.value;
      }
      set value(value) {
        super.value = globalThis.Boolean(value);
      }
      [Type.JSON]() {
        return Number(this.value);
      }
      // [Symbol.toPrimitive]() {
      //   return Number(this.value);
      // }
    };

    this.Int = class Int extends Type.new("number", this.#numberGenerator) {
      get value() {
        return super.value;
      }
      set value(value) {
        const integerValue = Number.parseInt(value);
        if(Number.isNaN(integerValue)) {
          throw new TypeError(`${ value } cannot be casted to Integer`);
        }
        super.value = integerValue;
      }

    };

    this.Float = class Float extends Type.new("number", this.#numberGenerator) {
      get value() {
        return super.value;
      }
      set value(value) {
        const floatValue = Number.parseFloat(value);
        if(Number.isNaN(floatValue)) {
          throw new TypeError(`${ value } cannot be casted to Float`);
        }
        super.value = floatValue;
      }

    };

    this.DateTime = class DateTime extends Type.new("string", this.#dateTimeGenerator, 64) {
      get value() {
        return super.value;
      }
      set value(value) {
        const timestamp = Date.parse(value);
        if(Number.isNaN(timestamp)) {
          throw new TypeError(`${ value } cannot be casted to DateTime`);
        }
        super.value = value;
      }
    };

    /** @template {ExtendedType} [T=ExtendedType] */
    this.Array = class Array extends Type.new("object", /** @type {() => Generator<InstanceType<T>[]>} */ function *() {
      while(true) yield [];
    }, 0) {

      get value() {
        return super.value;
      }

      set value(value) {
        if(value instanceof globalThis.Array === false) {
          throw new TypeError(`'${ value }' cannot be casted to Array`);
        }
        super.value = value.slice();
      }

      [Type.JSON]() {
        return JSON.stringify(this.value);
      }

      /**
       * @template {ExtendedType} T
       * @param {T} type
       * @param {number} limit
       */
      static construct(type, limit) {
        /** @extends {Array<T>} */
        class TypedArray extends this {

          static #type = type;
          static limit = limit;
          static [Type.SIZE] = type.size * limit + (limit === 0 ? 0 : limit - 1) + (type.primitiveType === "string" ? limit * 2 : 0) + 2;

          /** @returns {T extends ExtendedType ? InstanceType<T>["value"][] : ExtendedType[]} */
          get value() {
            return Object.freeze(super.value.slice());
          }

          set value(value) {
            if(value instanceof globalThis.Array === false) {
              throw new TypeError(`'${ value }' cannot be casted to TypedArray<${ TypedArray.defaultValue }>`);
            }
            if(value.length > TypedArray.limit) {
              throw new TypeError(`Array<${ TypedArray.#type.name }>.value: limit exceeded '${ TypedArray.limit }'`);
            }
            super.value = value;
          }

          /** @param {this | InstanceType<T>[]} operand */
          [Type["=="]](operand) {
            const array = operand instanceof this.constructor ? operand.value : operand;
            if(array.length !== super.value.length) {
              return false;
            }
            for(const index of super.value.keys()) {
              if(!super.value[index].match(array[index])) {
                return false;
              }
            }
            return true;
          }

          /** @param {InstanceType<T>} item */
          push(item) {
            if(super.value.length >= TypedArray.size) {
              throw new TypeError(`Array<${ TypedArray.#type.name }>.push(): limit exceeded '${ TypedArray.size }'`);
            }
            if(item instanceof TypedArray.#type === false) {
              throw new TypeError(`Array<${ TypedArray.#type.name }>.push(item = '${ item }'): item is not an instance of '${ TypedArray.#type.name }'`);
            }
            return super.value.push(item);
          }

          at(index) {
            return super.value.at(index);
          }

          get [Symbol.toStringTag]() {
            return `${ TypedArray.name }<${ TypedArray.#type.name }>`;
          }

        };
        return TypedArray;
      }

    };

    /** @template {{ [key: string]: ExtendedType }} [V={ [key: string]: ExtendedType }] */
    this.Object = class Object extends Type.new("object", /** @type {() => Generator<V>} */ function *() {
      while(true) yield {};
    }) {

      get value() {
        return super.value;
      }

      set value(value) {
        if(value instanceof globalThis.Object === false) {
          throw new TypeError(`'${ value }' cannot be casted to Object`);
        }
        super.value = value;
      }

      [Type.JSON]() {
        return JSON.stringify(this.value);
      }

      /**
       * @template {{ [key: string]: ExtendedType }} T
       * @param {T} type
       */
      static construct(type) {
        /** @extends {Object<T>} */
        class TypedObject extends this {

          static #object = type;
          static {
            const entries = globalThis.Object.entries(type);
            const keysCount = entries.length;
            const commas = keysCount === 0 ? 0 : keysCount - 1;
            const invertedCommasAndColon = keysCount * 3;
            this[Type.SIZE] = entries.reduce((sum, [key, type]) => key.length + sum + type.size + (type.primitiveType === "string" ? type.size * 2 : 0), commas + invertedCommasAndColon + 2);
          }

          /** @returns {{ [K in keyof T]: InstanceType<T[K]> }} */
          get value() {
            const object = globalThis.Object.fromEntries(globalThis.Object.entries(super.value).map(([key, type]) => /** @type {const} */ ([key, type.value])));
            return globalThis.Object.freeze(object);
          }

          set value(value) {
            if(value instanceof globalThis.Object === false) {
              throw new TypeError(`'${ value }' cannot be casted to TypedObject<${ TypedObject.defaultValue }>`);
            }
            const object = {};
            for(const key in value) {
              object[key] = TypedObject.#object[key].from(value[key]);
            }
            super.value = object;
          }


          /**
           * @template {keyof T} K
           * @param {K} key
           * @param {T[K]} value
           */
          set(key, value) {
            if(key in TypedObject.#object === false) {
              throw new TypeError(`key: '${ key }' is not present in Object`);
            }
            super.value[key] = TypedObject.#object[key].from(value);
          }

          /**
           * @template {keyof T} K
           * @param {K} key
          */
          get(key) {
            return super.value[key];
          }

          get [Symbol.toStringTag]() {
            return `${ TypedObject.name }`;
          }

        };
        return TypedObject;
      }

    };

    /** @template {ExtendedType} [T=ExtendedType] */
    this.Set = class Set extends Type.new("object", /** @type {() => Generator<globalThis.Map<InstanceType<T>["value"], InstanceType<T>>>} */ function *() {
      while(true) yield new Map;
    }, 0) {

      get value() {
        return super.value;
      }

      set value(value) {
        if(value instanceof globalThis.Map === false) {
          throw new TypeError(`'${ value }' cannot be casted to Set`);
        }
        super.value = new globalThis.Map(value);
      }

      /**
       * @template {ExtendedType} T
       * @param {T} type
       * @param {number} limit
       */
      static construct(type, limit) {
        /** @extends {Set<T>} */
        class TypedSet extends this {

          static #type = type;
          static limit = limit;
          static [Type.SIZE] = type.size * limit + (limit === 0 ? 0 : limit - 1) + (limit * 2) + 2;

          /** @returns {T extends ExtendedType ? globalThis.Set<InstanceType<T>> : globalThis.Map<ExtendedType>} */
          get value() {
            return Object.freeze(new globalThis.Set(super.value.values()));
          }

          set value(value) {
            if(value instanceof globalThis.Set === false && value instanceof globalThis.Array === false) {
              throw new TypeError(`'${ value }' cannot be casted to TypedSet<${ TypedSet.defaultValue }>`);
            }
            if(value.size > TypedSet.limit) {
              throw new TypeError(`Set<${ TypedSet.#type.name }>.value: limit exceeded '${ TypedSet.limit }'`);
            }
            super.value = new globalThis.Map(Array.from(value).map(item => {
              const instance = TypedSet.#type.from(item);
              return [instance.value, instance];
            }));
          }

          [Type.JSON]() {
            return JSON.stringify(Array.from(this.value));
          }

          /** @param {InstanceType<T>} item */
          add(item) {
            if(super.value.size >= TypedSet.size) {
              throw new TypeError(`Set<${ TypedSet.#type.name }>.add(): limit exceeded '${ TypedSet.size }'`);
            }
            if(item instanceof TypedSet.#type === false) {
              throw new TypeError(`Set<${ TypedSet.#type.name }>.add(item = '${ item }'): item is not an instance of '${ TypedSet.#type.name }'`);
            }
            return super.value.set(item.value, item);
          }

          /** @param {InstanceType<T> | InstanceType<T>["value"]} item */
          has(item) {
            return super.value.has(item instanceof TypedSet.#type ? item.value : item);
          }

          /** @param {InstanceType<T>} item */
          delete(item) {
            return super.value.delete(item instanceof TypedSet.#type ? item.value : item);
          }

          get [Symbol.toStringTag]() {
            return `${ TypedSet.name }<${ TypedSet.#type.name }>`;
          }

        };
        return TypedSet;
      }

    };

  };

};