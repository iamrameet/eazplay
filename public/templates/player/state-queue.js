import ExtendedEventTarget from "../../modules/extended-event.js";

/** @extends {ExtendedEventTarget<{ change: { current: number; previous: number } }>} */
export default class StateQueue extends ExtendedEventTarget {

  #size;
  #selected = -1;
  #isCircular;

  /** @param {{ size?: number; circular?: boolean }} config */
  constructor(config) {
    super();
    this.#size = config?.size ?? 0;
    this.#isCircular = Boolean(config?.circular);
  }

  get selected() {
    return this.#selected;
  }

  get circular() {
    return this.#isCircular;
  }

  set circular(value) {
    this.#isCircular = Boolean(value);
  }

  get size() {
    return this.#size;
  }

  set size(value) {
    this.#size = value;
    this.#selected = -1;
    // this.select(0);
  }

  /** @param {number} index */
  select(index) {
    if(Number.isNaN(index) || index < 0 || index >= this.#size) {
      return false;
    }
    const previous = this.#selected;
    this.#selected = index;
    this.trigger("change", { current: this.#selected, previous });
    return true;
  }

  next() {
    let nextIndex = this.#selected + 1;
    if(this.#isCircular) {
      nextIndex %= this.#size;
    }
    return this.select(nextIndex);
  }

  previous() {
    let prevIndex = this.#selected - 1;
    if(this.#isCircular) {
      prevIndex = (this.#size + prevIndex) % this.#size;
    }
    return this.select(prevIndex);
  }

};