/** @typedef {{ create: void; destroy: never; }} SessionEventMap */
/** @typedef {{ createHandler(): Promise<{ id: string }>, destroyHandler(): Promise<undefined> }} SessionConfig */

import ExtendedEventTarget from "./extended-event";

/** @extends {ExtendedEventTarget<SessionEventMap>} */
export class Session extends ExtendedEventTarget {
  #id;
  #isValid = false;
  #handlers = {
    /** @type {() => Promise<{ id: string }>} */
    create: null,
    /** @type {() => Promise<undefined>} */
    destroy: null
  };

  /** @param {SessionConfig} config  */
  constructor(config) {
    this.#handlers.create = config.createHandler;
    this.#handlers.destroy = config.destroyHandler;
  }

  get isValid() {
    return this.#isValid;
  }
  async create() {
    const data = await this.#handlers.create();
    if("id" in data === false) {
      return;
    }
    this.#isValid = true;
    this.#id = data.id;
    this.trigger("create");
  }
  async destroy() {
    await this.#handlers.destroy();
    this.#isValid = false;
    this.trigger("destroy");
  }
};


/** @template {{ "get": { [url: string]: {} }, "post": { [url: string]: { body: {}, data: {} } } }} RequestMap */
export class RequestAPI {
  static #version = "0.0.0";

  /** @type {Set<Function>} */
  #errorHandlers = new Set();

  /** @param {Promise<Response>} request */
  async #requestHandler(request, errorMessage) {
    try {
      const response = await request;
      /** @type { version: string; data: any } */
      const dataResponse = await response.json();
      if("version" in dataResponse === false) {
        throw "Received data is invalid";
      }
      if(dataResponse.version in RequestAPI.versionMap === false) {
        throw "Received data version is not supported";
      }
      if(!response.ok) {
        throw dataResponse.message;
      }
      return RequestAPI.versionMap[dataResponse.version](dataResponse.data);
    } catch(ex) {
      reportError(ex);
      const error = new RequestAPI.ResponseError(ex, errorMessage);
      if(this.#errorHandlers.size === 0) {
        throw error;
      }
      this.#errorHandlers.forEach(handler => handler.call(this, error));
      return null;
    }
  }

  /**
   * @template {keyof RequestMap["get"]} T
   * @param {T} url
   * @throws {RequestAPI.ResponseError}
   * @returns {Promise<RequestMap["get"][T] | null>}
  */
  get(url, errorMessage) {
    return this.#requestHandler(fetch({ url }), errorMessage);
  }

  /**
   * @template {keyof RequestMap["post"]} T
   * @param {T} url
   * @param {RequestMap["post"][T]["body"]} dataObject
   * @throws {RequestAPI.ResponseError}
   * @returns {Promise<RequestMap["post"][T]["data"] | null>}
  */
  postJSON(url, dataObject, errorMessage) {
    return this.#requestHandler(fetch({
      url,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dataObject)
    }), errorMessage);
  }

  /** @param {(error: RequestAPI.ResponseError) => void} handler */
  onError(handler) {
    this.#errorHandlers.add(handler);
  }

  /** @param {(error: RequestAPI.ResponseError) => void} handler */
  offError(handler) {
    this.#errorHandlers.delete(handler);
  }
};

// /** @type {{ [version: string]: () => Promise<{}> }} */
RequestAPI.versionMap = {
  /** @param {{}} data */
  "0.0.0"(data) {
    return data;
  }
};

RequestAPI.ResponseError = class ResponseError extends Error {
  /** @param {Error | string} originalError */
  constructor(originalError, message) {
    this.originalMessage = originalError instanceof Error ? originalError.message : originalError;
    super(message);
  }
};

/** @typedef {{ get: { "/api/auth": { id: string } }, post: { "/api/login": { body: { username: string; password: string },  data: { id: string } } } }} XFetchRequestMap */

/** @type {RequestAPI<XFetchRequestMap>} */
const requestAPI = new RequestAPI();

requestAPI.onError(error => {
  console.log(error.message, error.originalMessage);
  // display to UI
});

const sess = new Session({
  async createHandler(username, password) {
    return await requestAPI.postJSON("/api/login", { username, password }, "Login failed");
  }
});
sess.on("destroy", async function(event) {
  return await requestAPI.get("/logout");
});