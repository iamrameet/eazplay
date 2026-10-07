export default class AsyncQueue {
  /** @type {(() Promise)[]} */
  #queue = [];
  get isEmpty(){
    return this.#queue.length === 0;
  }

  /** @param {() => Promise} action */
  enqueue(action, identifier) {
    action.identifier = identifier;
    // console.log("quequed:", action.identifier);
    this.#queue.push(action);
    if(this.#queue[0] === action) {
      this.#dequeue();
    }
  }

  /**
   * @template T
   * @param {() => Promise<T>} action
   * @returns {Promise<T>}
   */
  enqueuePromise(action, identifier) {
    return new Promise((resolve, reject) => {
      this.enqueue(async function() {
        try {
          resolve(await action());
        } catch (ex) {
          reject(ex);
        }
      }, identifier);
    });
    action.identifier = identifier;
    // console.log("quequed:", action.identifier);
    this.#queue.push(action);
    if(this.#queue[0] === action) {
      this.#dequeue();
    }
  }

  async #dequeue() {
    if(this.isEmpty){
      return null;
    }
    // console.log("dequequing:", this.#queue[0].identifier);
    await this.#queue[0]();
    this.#queue.shift();
    await this.#dequeue();
  }
};