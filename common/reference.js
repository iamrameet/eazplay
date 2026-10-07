/** @template {WeakKey} T */
class ReferenceLock {

  /** @type {Map<WeakKey, { keys: Set<symbol>; instance: ReferenceLock<WeakKey> }>} */
  static #references = new WeakMap;

  /** @type {T | null} */
  #object;

  /**
   * @param {T} object
   * @param {symbol} key
   */
  constructor(object, key) {
    if(ReferenceLock.#references.has(object)) {
      const value = ReferenceLock.#references.get(object);
      value.keys.add(key);
      return value.instance;
    }
    this.#object = object;
    ReferenceLock.#references.set(object, {
      keys: new Set([key]),
      instance: this
    });
  }

  ref() {
    if(this.#object === null) {
      throw new ReferenceError(`Cannot reference to a released object`);
    }
    return this.#object;
  }

  tryRef() {
    return this.#object;
  }

  /**
   * @template R
   * @template [V=null]
   * @param {(ref: T) => R} callbackfn
   * @param {V} fallbackValue
   */
  ifRef(callbackfn, fallbackValue = null) {
    if(this.#object !== null) {
      return callbackfn(this.#object);
    }
    return fallbackValue;
  }

  /** @param {symbol} key */
  release(key) {
    const value = ReferenceLock.#references.get(this.#object);
    if(value === undefined) {
      return false;
    }
    value.keys.delete(key);
    if(value.keys.size === 0) {
      ReferenceLock.#references.delete(this.#object);
      this.#object = null
    }
    return true;
  }

  /**
   * @template {WeakKey} T
   * @template R
   * @param {T} object
   * @param {(object: T) => R | Promise<R>} callbackfn
   */
  static async scope(object, callbackfn) {
    const key = Symbol();
    const ref = new ReferenceLock(object, key);
    const result = await callbackfn(object);
    ref.release(key);
    return result;
  }

};

const array = [{ A: 10 }];

for(const element of array) {
  const a = await ReferenceLock.scope(element, element => element.A);
}

export { ReferenceLock }