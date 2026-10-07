import CachedMap from "./cached-map.js";

class CachedFetch {

/** @type {CachedMap<string, Response>} */
  #urlMap;

  constructor(limit = 10) {
    this.#urlMap = new CachedMap(limit);
  }

  /**
   * @param {string} url
   * @param {RequestInit & { manualCache?: boolean }} options
  */
  async fetch(url, options = {}) {

    if(options?.manualCache !== false && this.#urlMap.has(url)) {
      return this.#urlMap.get(url).clone();
    }

    const response = await fetch(url);
    this.#urlMap.set(url, response);
    return response.clone();

  }

};

export default CachedFetch;