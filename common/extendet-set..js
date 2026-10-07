import { definePrototypeProperties } from "./better-definitions.js";

/**
 * @template T
 * @extends {Set<T>}
*/
export default class ExtendedSet extends Set {
  /** @param {readonly T[] | null} values */
  constructor(values) {
    super(values);
  }
  /** @param {number} index */
  atIteration(index) {
    for(const item of this) {
      if(index === 0) {
        return item;
      }
      index--;
    }
  }
}