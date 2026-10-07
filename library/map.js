/** @template {any[]} T */
export class Tuple {

  /** @type {Map<any, { tuple: ?Tuple; map: Map<any, []> }>} */
  static #map = new Map;

  /** @param {T} args */
  constructor(...args) {
    return Tuple.#set(Tuple.#map, args, this);
  }

  /**
   * @param {Map<any, { tuple: ?Tuple; map: Map<any, []> }>} currentMap
   * @param {any[]} remainingArgs
   * @param {Tuple} currentTuple
   * @returns {Tuple}
   */
  static #set(currentMap, remainingArgs, currentTuple) {
    if(remainingArgs.length === 0) {
      return currentTuple;
    }

    const [first, ...rest] = remainingArgs;

    if(!currentMap.has(first)) {
      currentMap.set(first, {
        tuple: null,
        map: new Map(),
      });
    }

    if(rest.length === 0) {
      const tuple = currentMap.get(first);
      if(tuple !== null) {
        return tuple;
      }
      currentMap.get(first).tuple = currentTuple;
    }

    return this.#set(currentMap.get(first).map, rest, currentTuple);
  }

};

/** @template {WeakKey[]} T */
export class WeakTuple {

  /** @type {WeakMap<WeakKey, { tuple: ?WeakTuple; map: WeakMap<WeakKey, []> }>} */
  static #map = new WeakMap;

  /** @param {T} args */
  constructor(...args) {
    return WeakTuple.#set(WeakTuple.#map, args, this);
  }

  /**
   * @param {WeakMap<WeakKey, { tuple: ?WeakTuple; map: WeakMap<WeakKey, []> }>} currentMap
   * @param {WeakKey[]} remainingArgs
   * @param {WeakTuple} currentTuple
   * @returns {WeakTuple}
   */
  static #set(currentMap, remainingArgs, currentTuple) {
    if(remainingArgs.length === 0) {
      return currentTuple;
    }

    const [first, ...rest] = remainingArgs;

    if(!currentMap.has(first)) {
      currentMap.set(first, {
        tuple: null,
        map: new WeakMap(),
      });
    }

    if(rest.length === 0) {
      const tuple = currentMap.get(first);
      if(tuple !== null) {
        return tuple;
      }
      currentMap.get(first).tuple = currentTuple;
    }

    return this.#set(currentMap.get(first).map, rest, currentTuple);
  }

};

/** @template {(string | number | boolean | bigint | undefined)[]} T */
export class PrimitiveTuple {

  /** @type {Map<string, PrimitiveTuple>} */
  static #map = new Map;

  /** @param {T} args */
  constructor(...args) {
    const key = args.map(arg => `${ typeof arg }[${ arg }]`).join("");
    if(PrimitiveTuple.#map.has(key)) {
      return PrimitiveTuple.#map.get(key);
    }
    PrimitiveTuple.set(key, this);
  }

};

/**
 * @template {string | number | boolean | symbol | bigint} V1
 * @template {string | number | boolean | symbol | bigint} V2
 * @extends {Tuple<V1, V2>}
 */
export class Pair extends Tuple {

  #first;
  #second;

  /**
   * @param {V1} first
   * @param {V2} second
   */
  constructor(first, second) {
    super(first, second);
    this.#first = first;
    this.#second = second;
  }

  get first() {
    return this.#first;
  }
  get second() {
    return this.#second;
  }
  get [0]() {
    return this.#first;
  }
  get [1]() {
    return this.#second;
  }

};

/**
 * @template T
 * @extends {Array<T>}
 */
export class TArray extends Array {

  /**
   * @overload
   * @param {T[]} items
   * @overload
   * @param {number} size
   */
  constructor(...items) {
    super(...items)
  }

  /** @param {(pair: Pair<number, T>, array: this) => Promise<void> | void} callbackfn  */
  async forEach(callbackfn) {
    for(const pair of this.entries()) {
      await callbackfn(pair, this);
    }
  }

  /**
   * @template R
   * @param {(pair: Pair<number, T>, array: this) => Promise<R> | R} callbackfn
   */
  async map(callbackfn) {
    const result = [];
    for(const pair of this.entries()) {
      result.push(await callbackfn(pair, this));
    }
    return result;
  }

  /** @param {(pair: Pair<number, T>, array: this) => Promise<boolean> | boolean} callbackfn */
  async filter(callbackfn) {
    const result = [];
    for(const pair of this.entries()) {
      if(await callbackfn(pair, this)) {
        result.push(pair.second);
      }
    }
    return result;
  }

  /**
   * @template R
   * @param {(pair: Pair<number, T>, skipRest: () => false) => Promise<boolean> | boolean} filterFn
   * @param {(pair: Pair<number, T>) => R} mapFn
   * @param {{ flatDepth?: number }} [options]
   */
  async filterMap(filterFn, mapFn, options) {
    const result = [];
    let shouldSkipRest = false;
    function skipRest() {
      shouldSkipRest = true;
      return false;
    }
    for(const pair of this.entries()) {
      if(await filterFn(pair, skipRest)) {
        result.push(await mapFn(pair));
      }
      if(shouldSkipRest === true) {
        break;
      }
    }
    return result;
  }

  *entries() {
    for(const entry of super.entries()) {
      yield new Pair(...entry);
    }
  }

};

export class TObject {

  /**
   * @template {{}} T
   * @param {T} object
   */
  static *entries(object) {
    for(const key in object) {
      /** @type {T[typeof key]} */
      const value = object[key];
      yield /** @type {const} */ ([key, value]);
    }
  }

};

/**
 * @template K
 * @template V
 * @extends {Map<K, V>}
 */
export class TMap extends Map {

  /** @param {Iterable<readonly [K, V]> | Pair<K, V>[]} [iterable] */
  constructor(iterable) {
    super(iterable);
  }

  *entries() {
    for(const entry of super.entries()) {
      yield new Pair(...entry);
    }
  }

  *[Symbol.iterator]() {
    for(const entry of this.entries()) {
      yield entry
    }
  }

};

/**
 * @template T
 * @extends {Set<T>}
 */
export class TSet extends Set {

  /** @param {Iterable<T>} [iterable] */
  constructor(iterable) {
    super(iterable);
  }

  /** @param {(pair: Pair<T, T>, set: this) => Promise<void> | void} callbackfn  */
  async forEach(callbackfn) {
    for(const pair of this.entries()) {
      await callbackfn(pair, this);
    }
  }

  *entries() {
    for(const entry of super.entries()) {
      yield new Pair(...entry);
    }
  }

  /**
   * @template T
   * @param {Iterable<T>} iterable
   * @param {number} [start]
   * @param {number} [end]
   */
  static from(iterable, start, end) {
    /** @type {TSet<T>} */
    const set = new TSet;
    let index = start ?? 0;
    for(const it of iterable) {
      if(index >= end) {
        break;
      }
      set.add(it);
      index++;
    }
    return set;
  }

};