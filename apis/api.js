/// <reference path="api.h.ts"/>

import { net } from "electron";

/** @template {EndPointsMap} [T={}] */
export default class FetchAPI {

  #base;
  #defaultRequestInit;

  /**
   * @param {string} base
   * @param {RequestInit & { bypassCustomProtocolHandlers?: boolean; }} defaultRequestInit
   */
  constructor(base, defaultRequestInit) {
    this.#base = new URL(base);
    this.#defaultRequestInit = defaultRequestInit;
  }

  /** @param {RequestInit & { bypassCustomProtocolHandlers?: boolean; }} requestInit */
  setDefaultRequestInit(requestInit = {}) {
    this.#defaultRequestInit = requestInit;
  }

  /**
   * @template {keyof T} K
   * @template {T[K][number]["params"]} P
   * @param {K} endpoint
   * @param {P} [searchParams]
   * @param {RequestInit & { bypassCustomProtocolHandlers?: boolean; }} requestInit
   * @returns {Promise<ResultUsingParam<T, K, P>[keyof ResultUsingParam<T, K, P>]["result"]>}
   */
  async get(endpoint, searchParams = {}, requestInit = {}) {
    const url = new URL(this.#base.pathname + endpoint, this.#base.origin);
    for(const param in searchParams) {
      if(typeof searchParams[param] === "string") {
        url.searchParams.set(param, searchParams[param]);
        continue;
      }
      for(const value of searchParams[param]) {
        url.searchParams.append(param, value);
      }
    }
    const response = await net.fetch(url, { ...this.#defaultRequestInit, ...requestInit });
    return await response.json();
  }

};