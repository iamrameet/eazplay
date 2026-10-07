/** @template {number | bigint} T */
export class NumericRange {

  /** @type {T} */
  #start;
  /** @type {T} */
  #stop;
  /** @type {T} */
  #step;
  /** @type {-1 | 0 | 1} */
  #direction;
  #isBigInt;

  /**
   * @overload
   * @param {T} stop
   * @overload
   * @param {T} start
   * @param {T} stop
   * @param {T} [step=1]
   * @returns
   * @param {[stop: T] | [start: T, stop: T, step?: number | bigint]} args
   */
  constructor(...args) {
    const hasSingleArg = args.length === 1;
    const stop = hasSingleArg ? args[0] : args[1];
    const start = hasSingleArg ? 0 : args[0];
    const step = hasSingleArg ? 1 : (args[2] ?? 1);

    if((typeof start !== "number" && typeof start !== "bigint") || start === Infinity) {
      throw new Error("Range `start` must be a valid finite number");
    }
    if((typeof stop !== "number" && typeof stop !== "bigint") || stop === Infinity) {
      throw new Error("Range `end` must be a valid finite number");
    }
    if((typeof step !== "number" && typeof step !== "bigint") || step === Infinity || step <= 0) {
      throw new Error("Range `step` must be a finite positve integer");
    }

    this.#isBigInt = typeof stop === "bigint";
    this.#stop = stop;
    this.#start = this.#isBigInt ? BigInt(start) : Number(start);
    this.#step = this.#isBigInt ? BigInt(step) : Number(step);
    this.#direction = Math.sign(Number(this.#stop - this.#start));
  }

  /** @param {T} value */
  has(value) {
    const hasValidN = this.#hasValidN(value);
    switch(this.#direction) {
      case -1:
        return hasValidN && value > this.#stop && value <= this.#start;
    }
    return hasValidN && value >= this.#start && value < this.#stop;
  }

  /** @param {T} nthTerm */
  #hasValidN(nthTerm) {
    const term = this.#isBigInt ? BigInt(nthTerm) : Number(nthTerm);
    return (term - this.#start) % this.#step === (this.#isBigInt ? 0n : 0);
  }

  /** @returns {Generator<T extends number ? number : T extends bigint ? bigint : T>} */
  *[Symbol.iterator]() {
    switch(this.#direction) {
      case 1:
        for(let i = this.#start; i < this.#stop; i += this.#step) {
          yield i;
        }
      break;
      case -1:
        for(let i = this.#start; i > this.#stop; i -= this.#step) {
          yield i;
        }
      break;
    }
  }

  toReversed() {
    return new NumericRange(this.#stop, this.#start, this.#step);
  }

  /**
   * @template {Array | Set | Map | Iterable | ReadonlyArray} T
   * @param {T} item
   * @returns {NumericRange<T extends ReadonlyArray ? T["length"] : T extends ReadonlyMap ? T["size"] : T extends ReadonlySet ? T["size"] : number>} */
  static from(item) {
    let stop = item instanceof Array ? item.length
      : item instanceof Set || item instanceof Map ? item.size
      : -1;
    if(stop === -1) {
      stop = 0;
      if(typeof item?.[Symbol.iterator] === "function") {
        for(const _ of item) {
          stop++;
        }
      }
    }
    return new NumericRange(0, stop);
  }

};