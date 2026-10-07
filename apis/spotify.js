/// <reference path="api.h.ts"/>

import { net } from "electron";
import { joined } from "../common/util.js";
import Logger from "../library/logger.js";
import { TObject } from "../library/map.js";
import FetchAPI from "./api.js";
import { generateTotp } from "../common/totp.js";

export default class SpotifyAPI {

  static #logger = new Logger("SpotifyAPI");
  /** @type {string | undefined} */
  static #accessToken;
  /** @type {FetchAPI<SpotifyAPIEndPointsMap>} */
  static #api = new FetchAPI("https://api.spotify.com/v1");

  static async oauth() {}

  static async acquireAccessToken(force = false) {
    if(this.#accessToken !== undefined && !force) {
      return;
    }
    try {
      const totp = await generateTotp();
      this.#logger.error("Acquiring Spotify access token with TOTP:", totp);
      const response = await net.fetch(`https://open.spotify.com/api/token?reason=init&productType=web-player&totp=${ totp }&totpServer=${ totp }&totpVer=21`);
      /** @type {{ clientId: string; accessToken: string; accessTokenExpirationTimestampMs: string; isAnonymous: boolean; _notes: string } | { error: { code: number; message: string } }} */
      const responseJSON = await response.json();
      if(responseJSON.error) {
        throw new Error(`Spotify access token response: ${ responseJSON.error.message }`);
      }
      this.#accessToken = JSON.parse(responseJSON.accessToken);
      this.#api.setDefaultRequestInit({
        headers: {
          Authorization: `Bearer ${ this.#accessToken }`
        }
      });
    } catch(ex) {
      this.#logger.error(ex);
      throw ex;
      throw new Error("unable to acquire access token");
    }
  }

  /** @param {string} isrc */
  static async getTracksByISRC(isrc) {
    const result = await this.#api.get("/search", {
      type: "track",
      q: `isrc:${ isrc }`
    });
    if(result.error) {
      throw new Error(`Spotify API error: ${ result.error.message }`);
    }
    this.#validateResponseResult(result);
    if(result.tracks.items.length === 0) {
      throw new Error("Track not available on Spotify");
    }
    return result.tracks.items;
  }

  /** @param {{ [K in SpotifyAPIEndPointsMap["/search"]["0"]["params"]["q"] as K extends `${ infer T }:${ string }` ? T : K ]?: string }} query */
  static async findTrack(query) {
    /** @type {SpotifyAPIEndPointsMap["/search"]["0"]["params"]["q"]} */
    const q = typeof query === "string" ? query : joined(query);
    const result = await this.#api.get("/search", {
      type: "track",
      q
    });
    this.#validateResponseResult(result);
    if(result.tracks.items.length === 0) {
      return null;
    }
    return result.tracks.items[0];
  }

  static #validateResponseResult(response) {
    if(response.error) {
      throw new Error(`Spotify API error: ${ response.error.message }`);
    }
  }

  static totp() {
    if(!this.#accessToken) {
      throw new Error("Spotify access token not acquired");
    }
    return this.#accessToken.totp;
  }

};