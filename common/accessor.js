/**
 * @template T
 * @template V
 */
export default class Accessor {

  #that;
  #getter;
  #setter;

  /**
   * @param {T} that
   * @param {(this: Accessor<T, V>, that: T) => V} getter
   * @param {(this: Accessor<T, V>, that: T, value: V) => Accessor<T, V>} setter
  */
  constructor(that, getter, setter) {
    this.#that = that;
    this.#getter = getter;
    this.#setter = setter;
  }

  get value() {
    return this.#getter(this.#that);
  }
  set value(value) {
    this.#setter(this.#that, value);
  }

  get() {
    return this.#getter(this.#that);
  }
  /** @param {V} value */
  set(value) {
    this.#setter(this.#that, value);
    return this;
  }

  [Symbol.toPrimitive]() {
    return this.#getter(this.#that);
  }

};