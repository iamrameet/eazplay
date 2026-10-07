/**
 * @template {{}} T
 * @typedef {{ [K in keyof T as T[K] extends Function ? never : K]: T[K] }} ExcludeFunctions */

/**
 * @template {{}} T
 * @typedef {{ [K in keyof T as T[K] extends Function ? K : never]: T[K] }} KeepFunctions */

/**
 * @template {{}} T
 * @typedef {{ [K in keyof T as T[K] extends new(...args: any[]) => any ? K : never]: T[K] }} KeepClasses */

/** @template {{}} ControlledProperties */
export default class ControlledType {

  /** @type {ControlledProperties} */
  #controlledData;

  static #assignedControllers = new WeakMap();
  #controllers;

  /**
   * @param {ControlledProperties} controlledData
   * @param {Controller<ControlledProperties, ControlledType<ControlledProperties>>[]} controllers */
  constructor(controlledData, controllers = []) {
    if(controllers.some(controller => !(controller instanceof ControlledType.Controller))) {
      throw `Controller is not of type 'ControlledType.Controller'`;
    }
    this.#controlledData = controlledData;
    this.#controllers = new Set(controllers);

    // const protectedController = new BaseType.Controller();
    // BaseType.#assignController(new.target, protectedController);
  }

  static #assignController(constructor, controller) {
    if(!ControlledType.#assignedControllers.has(constructor)) {
      ControlledType.#assignedControllers.set(constructor, controller);
    }
  }

  static Controller =
  /**
   * @template P
   * @template {ControlledType<P>} T
  */
  class Controller {

    /** @param {T} instance */
    #throwIfNotFound(instance) {
      if(!instance.#controllers.has(this)) {
        throw "Controller not allowed";
      }
    }

    /**
     * @template {keyof ExcludeFunctions<P>} K
     * @param {T} instance
     * @param {K} property
     * @param {ExcludeFunctions<P>[K]} value
     */
    set(instance, property, value) {
      this.#throwIfNotFound(instance);
      if(instance.#controlledData[property] instanceof Function) {
        throw "cannot set a function property";
      }
      instance.#controlledData[property] = value;
    }

    /**
     * @param {T} instance
     * @param {{ [K in keyof ExcludeFunctions<P>]: ExcludeFunctions<P>[K] }} object
     */
    setMultiple(instance, object) {
      this.#throwIfNotFound(instance);
      for(const property in object) {
        if(instance.#controlledData[property] instanceof Function) {
          throw "cannot set a function property";
        }
        instance.#controlledData[property] = object[property];
      }
    }

    /**
     * @template {keyof ExcludeFunctions<P>} K
     * @param {T} instance
     * @param {K} property
     * @returns {ExcludeFunctions<P>[K]}
     */
    get(instance, property) {
      this.#throwIfNotFound(instance);
      if(instance.#controlledData[property] instanceof Function) {
        throw "cannot get a function property";
      }
      return instance.#controlledData[property];
    }

    /**
     * @template {keyof KeepFunctions<P>} K
     * @param {T} instance
     * @param {K} property
     * @param {Parameters<KeepFunctions<P>[K]>} args
     * @returns {ReturnType<KeepFunctions<P>[K]>}
     */
    invoke(instance, property, ...args) {
      this.#throwIfNotFound(instance);
      if(instance.#controlledData[property] instanceof Function === false) {
        throw "cannot invoke a non-function property";
      }
      return instance.#controlledData[property].call(instance, ...args);
    }

    /**
     * @template {keyof KeepClasses<P>} K
     * @param {T} instance
     * @param {K} property
     * @param {ConstructorParameters<KeepClasses<P>[K]>} args
     * @returns {InstanceType<KeepClasses<P>[K]>}
     */
    construct(instance, property, ...args) {
      this.#throwIfNotFound(instance);
      if(instance.#controlledData[property] instanceof Function === false) {
        throw "cannot construct from a non-function property";
      }
      return new instance.#controlledData[property](instance, ...args);
    }
  };

};

/**
 * @template {{}} ControlledProperties
 * @param {ControlledProperties} properties
*/
export function createControlledType(properties) {
  /** @template {ControlledProperties} T */
  return class ControlledType {
    #controlledData = properties;
    /** @param {InstanceType<typeof ControlledType.Controller>} controller */
    constructor(controller) {}
    static Controller = class Controller {
      /** @param {keyof ControlledProperties} key */
      set(key) {}
    };
  };
}

/**
 * @template P
 * @template {ControlledType<P>} T
 * @typedef {{ set: <K extends keyof ExcludeFunctions<P>>(instance: T, property: K, value: ExcludeFunctions<P>[K]) => void; setMultiple: (instance: T, object: { [K in keyof ExcludeFunctions<P>]: ExcludeFunctions<P>[K]; }) => void; get: <K extends keyof ExcludeFunctions<P>>(instance: T, property: K) => ExcludeFunctions<P>[K]; invoke: <K extends keyof KeepFunctions<P>>(instance: T, property: K, ...args: Parameters<KeepFunctions<P>[K]>) => ReturnType<KeepFunctions<P>[K]>; construct: <K extends keyof KeepClasses<P>>(instance: T, property: K, ...args: ConstructorParameters<KeepClasses<P>[K]>) => InstanceType<KeepClasses<P>[K]> }} Controller
*/