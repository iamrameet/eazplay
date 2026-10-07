/**
 * @template T
 * @template R
 * @param {T} target
 * @param {(this: T, target: T) => R} fn
 * @returns {R}
 */
function scope(target, fn) {
  return fn.call(target, target);
}

class User {
  id = "";
  name = "";
  age = 20;
};

const user = new User();

const result = await scope({ user }, async function() {
  const { user } = this;
  user.age++;
  return await Promise.resolve(user);
});

/**
 * @template P
 * @template A
*/
class EntityType {

  #_constructor = () => {};
  #Entity;

  /**
   * @param {P} properties
   * @param {{ constructor: (this: { [K in keyof P]: Array extends P[K] ? Array<InstanceType<P[K][number]>> : InstanceType<P[K]> } & { onSet: <K extends keyof P>(eventName: K, handler: (data: Array extends P[K] ? Array<InstanceType<P[K][number]>> : InstanceType<P[K]>) => boolean) => void }, ...args: A) => void }} predefines
  */
  constructor(properties = {}, predefines = {}) {
    if("constructor" in properties && typeof properties.constructor === "function") {
      this.#_constructor = properties.constructor;
    }
    const type = this;
    this.#Entity = class Entity {
      #type = type;
      constructor(...args) {
        type.#_constructor(...args);
      }
    };
  }

  /** @returns {{ [K in keyof P]: Array extends P[K] ? Array<InstanceType<P[K][number]>> : InstanceType<P[K]> } & { onChange: <K extends keyof P>(eventName: K, handler: (data: Array extends P[K] ? Array<InstanceType<P[K][number]>> : InstanceType<P[K]>) => void) => void }} */
  create(...args) {
    return new this.#Entity(...args);
  }

};

/** @template T */
class TypedArray {

  /** @param {T} args */
  constructor(...args) {}

  static having() {}

};

/** @template T */
class TemplateClass {

  /**
   * @template {{}} T
   * @template C
   * @param {T} templates
   * @param {C} classDefinition
   * @returns {typeof TemplateClass<keyof T>}
   */
  static new(templates, classDefinition) {}

};


const ArrayT = TemplateClass.new({ T: any , F: any }, class extends Array {

  constructor() {
    super();
  }

});

const array = new ArrayT;

const Person = new EntityType({
  id: String,
  name: String,
  age: Number,
  contacts: [ User ]
}, {
  /** @param {string} name */
  constructor(name) {
    this.name = name;
    this.age = 56;
    this.contacts.push(new User());
    this.onSet("contacts", data => data instanceof TypedArray.having(Number));
  }
});

const person = Person.create("Karan");

person.onChange("contacts", data => {});