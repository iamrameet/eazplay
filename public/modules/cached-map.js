/**
 * @template K
 * @template V
 * @extends {Map<K, V>}
*/
class CachedMap extends Map {

  #limit = Infinity;
  #clearTimeout = Infinity;
  #clearTimeoutId = null;

  constructor(options = { limit: Infinity, clearTimeout: Infinity }) {
    super();
    this.setLimit(options?.limit ?? Infinity);
    this.setClearTimeout(options?.clearTimeout ?? Infinity);
  }

  /** @param {K} key */
  get(key) {
    const value = super.get(key);
    this.delete(key);
    super.set(key, value);
    this.#setTimeout();
    return value;
  }

  /**
   * @param {K} key
   * @param {V} value
   */
  set(key, value) {
    if(this.size >= this.#limit) {
      this.#deleteFirst();
    }
    this.delete(key);
    this.#setTimeout();
    return super.set(key, value);
  }

  /** @param {number} value */
  setLimit(value) {
    if(typeof value !== "number") {
      return console.warn("CachedMap.setLimit: a number expected");
    }
    if(value < 0) {
      return console.warn("CachedMap.setLimit: value out-of-range");
    }
    while(this.size > this.#limit) {
      this.#deleteFirst();
    }
    this.#limit = value;
  }

  /** @param {number} timeout */
  setClearTimeout(timeout) {
    if(typeof timeout !== "number") {
      return console.warn("CachedMap.setClearTimeout: a number expected");
    }
    if(timeout < 0) {
      return console.warn("CachedMap.setClearTimeout: timeout out-of-range");
    }
    this.#clearTimeout = timeout;
  }

  #deleteFirst() {
    const [ pair ] = this;
    if(pair !== undefined) {
      this.delete(pair[0]);
    }
  }

  #setTimeout() {
    clearTimeout(this.#clearTimeoutId);
    if(this.#clearTimeout !== Infinity) {
      this.#clearTimeoutId = setTimeout(() => this.clear(), this.#clearTimeout);
    }
  }

};

export default CachedMap;