/**
 * Toggles between multiple states
 * @template {{}} T
 */
export default class StateToggler {
  #eventTarget = new EventTarget();
  #states;
  #currentState = 0;

  constructor(states = 2) {
    if(states < 2) {
      throw "Can not toggle between less than 2 states.";
    }
    this.#states = states;
  }

  get currentState() {
    return this.#currentState;
  }

  get states() {
    return this.#states;
  }

  toggle(extra = {}) {
    const previousState = this.#currentState;
    this.#currentState = (this.#currentState + 1) % this.#states;
    this.#eventTarget.dispatchEvent(new StateToggler.StateChangeEvent(previousState, this.#currentState, extra));
  }

  toggleBack(extra = {}) {
    const previousState = this.#currentState;
    this.#currentState = (this.#currentState - 1 + this.#states) % this.#states;
    this.#eventTarget.dispatchEvent(new StateToggler.StateChangeEvent(previousState, this.#currentState, extra));
  }

  /** @param {T} extra */
  force(state, extra = {}) {
    if(state < 0 || state >= this.#states) {
      throw "State out-of-range";
    }
    // if(this.#currentState === state) {
    //   return;
    // }
    const previousState = this.#currentState;
    this.#currentState = state;
    this.#eventTarget.dispatchEvent(new StateToggler.StateChangeEvent(previousState, this.#currentState, extra));
  }

  /**
   * @param {"change"} eventType
   * @param {(event: StateToggler.StateChangeEvent<T>)} handler
  */
  on(eventType, handler) {
    this.#eventTarget.addEventListener(eventType, handler);
  }


};
/**
 * The `change` Event class
 * @template {{}} T
*/
StateToggler.StateChangeEvent = class StateChangeEvent extends Event {
  /**
   * @param {number} previous Previous state
   * @param {number} current Current state
   * @param {T} extra
  */
  constructor(previous, current, extra = {}) {
    super("change");
    this.previousState = previous;
    this.currentState = current;
    this.extra = extra;
  }
};