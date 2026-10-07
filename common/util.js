/** @type {<T, R>(object: T, scope: (this: T extends {} ? T : never, ref: T extends {} ? T : never) => R) => T extends {} ? R : void} */
export function using(object, scope) {
  if(object !== null && object instanceof Object) {
    return scope.call(object, object);
  }
}

/** @type {<T, F extends (...args: any[]) => any>(fn: F, thisArg: T, args: F extends (...args: infer A) => any ? A : never) => F extends (...args: any[]) => infer R ? R : never} */
export function fnApply(fn, thisArg, args) {
  return fn.apply(thisArg, args);
}

/** @type {<T, F extends (...args: any[]) => any, A extends any[]>(fn: F, thisArg: T, ...args: A) => F extends (...args: infer P) => infer R ? (this: T, ...args: P extends A ? never[] : P ) => R : F} */
export function fnBind(fn, thisArg, ...args) {
  return fn.bind(thisArg, ...args);
}

/** @type {<T extends new (...args: any[]) => any>(Type: T, ...args?: ConstructorParameters<T>) => InstanceType<T>} */
export function construct(Type, ...args) {
  return new Type(...args);
}

/**
 * @template T
 * @template {keyof T} K
 * @typedef {{ configurable?: boolean; enumerable?: boolean; value?: T[K] extends (...args: infer A) => infer R ? (this: T, ...args: A) => R : T[K] ; writable?: boolean; get?(): T[K]; set?(v: T[K]): void; }} PropDescriptor */

/** @type {<T extends {}>(object: T, properties: { [K in keyof T]: PropDescriptor<T, K> }) => T} */
export function defineProperties(object, properties) {
  return Object.defineProperties(object, properties);
};

/** @type {<T extends new (...args: any[]) => any>(object: T, properties: { [K in keyof InstanceType<T>]: PropDescriptor<InstanceType<T>, K> }) => T} */
export function definePrototypeProperties(type, properties) {
  return Object.defineProperties(type.prototype, properties);
};

/** @type {<T extends Iterable<readonly [PropertyKey, any]>>(iterable: T) => T extends (readonly [infer K, infer V])[] ? { [k in K]: V } : never} */
export function fromEntries(iterable) {
  return Object.fromEntries(iterable);
};

/**
 * @template {any[]} T
 * @param {T} args
 */
export function stringify_if(...args) {
  /**
   * @param {TemplateStringsArray} strings
   * @param {number[]} positions
  */
  function caller(strings, ...positions) {
    if(args.some(arg => arg === undefined || arg === null)) {
      return "";
    }
    let result = strings[0];
    for(const [index, position] of positions.entries()) {
      result += args[position] + strings[index];
    }
    return result;
  };
  return caller;
}

/**
 * @template {string} T
 * @template V
 * @template D
 * @param {T} value
 * @param {{ [K in T]: V }} map
 * @param {D} defaultValue
 * @returns {V | D}
 */
export function mapper(value, map, defaultValue) {
  return value in map ? map[value] : defaultValue;
}

/**
 * @template {{}} T
 * @template D
 * @param {T} map
 * @param {D} defaultValue
 */
export function mapperWrapper(map, defaultValue) {
  /**
   * @template {keyof T} V
   * @param {V} value
   * @returns {T[V] | D}
   */
  function mapper(value) {
    return value in map ? map[value] : defaultValue;
  }
  return mapper;
}

/**
 * @template {{ [key: string]: string }} T
 * @template {string} [S=": "]
 * @template {string} [E=", "]
 * @param {T} object
 * @param {{ keyValue?: S; entries?: E }} [seperators]
 * @returns {Exclude<{ [K in keyof T]: `${ K }${ S }${ T[K] }` }[keyof T], undefined>}
 */
export function joined(object, seperators) {
  let stringified;
  const keyValueSeperator = seperators?.keyValue ?? ": ";
  const entriesSeperator = seperators?.entries ?? ", ";
  const keys = Object.keys(object);
  if(keys.length > 0) {
    stringified = `${ entriesSeperator }${ keys[0] }${ keyValueSeperator }${ object[keys[0]] }`;
    for(let i = 1; i < keys.length; i++) {
      stringified += `${ entriesSeperator }${ keys[i] }${ keyValueSeperator }${ object[keys[i]] }`;
    }
  }
  return stringified;
}
// issue:
// const entries = ([ /** @type {const} */ ([1, 2]), /** @type {const} */ (["4", "4"]), /** @type {const} */ ([5, false]) ]);
// const obj = fromEntries(entries);