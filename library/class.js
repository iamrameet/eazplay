/**
 * @template T
 * @template {any[]} C
 * @template {ClassPropertyScope} S
 * @template {ClassPropertyScope} I
 * @type {import("./class").Class<T, C, S, I>} */
export const Class = class Class {

  #properties;

  /** @param {} properties */
  constructor(properties) {
    this.#properties = properties;
  }

};

const Int = new Class({
  this: {
    public: {
      get r() {
        return 22;
      },
      g() {
        this.r
      }
    }
  },
  static: {
    public: {
      pub1: 20,
      g() {
        this.
      }
    }
  },
  constructor(timestamp) {
    return {};
  }
});

let d = new Int();