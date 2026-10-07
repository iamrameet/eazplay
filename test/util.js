export const Symbols = function() {
  const ASSIGN = Symbol();
  const CAST = Symbol();
  const FRIENDS = Symbol();
  return Object.freeze({ ASSIGN, CAST, FRIENDS });
}();

/**
 * @template T
 * @template {InstanceType<T>} V
*/
export class Ref {
  /** @type {T} */
  #type;
  /** @type {V} */
  #value;

  /** @param {T} type */
  constructor(type, options = {}) {
    if(new.target !== Ref) {
      throw "Cannot inherit from Ref";
    }
    this.#type = type;
    if(typeof options !== "object") {
      options = {};
    }
    if("initialValue" in options) {
      this.#setValue(options.initialValue);
    }
  }

  #setValue(value) {
    if(value instanceof this.#type) {
      this.#value = value;
    }
  }

  /** @param {V} value */
  [Symbols.ASSIGN](value) {
    this.#setValue(value);
    return value;
  }

  /**
   * @template {new (...args: any[]) => any} C
   * @param {C} type
   * @returns {InstanceType<C>}
   */
  [Symbols.CAST](type) {
    return new type(this.#value);
  }

  /**
   * @template T
   * @template {ThisType<T>} V
   * @param {Ref<T, V>} ref
   * @param {V} value
   */
  static value(ref, value = undefined) {
    if(ref instanceof Ref === false) {
      throw `variable must be of Ref type, ${ param1 } provided.`;
    }
    if(value instanceof ref.#type) {
      ref.#setValue(value);
    }
    return ref.#value;
  }
};

/**
 * @param {number} num1
 * @param {number} num2
 * @param {Ref<NumberConstructor, Number>} result
 */
function sum(num1, num2, result) {
  return result [Symbols.ASSIGN] (num1 + num2);
}

const result = new Ref(Number);
Ref.value(result, )

sum(20, 10, result);

const squaredValue = result [Symbols.CAST] (String);