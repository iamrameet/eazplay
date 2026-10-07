/// <reference path="api.h.ts"/>

import { net } from "electron";
import { readFileSync } from "node:fs";
import { joined } from "../common/util.js";
import Logger from "../library/logger.js";
import { TObject } from "../library/map.js";
import FetchAPI from "./api.js";

/** @returns {{ clientId: string; clientSecret: string }} */
function loadCredentials() {
  try {
    const file = readFileSync(new URL("../config/spotify.json", import.meta.url), "utf-8");
    const { clientId, clientSecret } = JSON.parse(file);
    if(clientId && clientSecret) {
      return { clientId, clientSecret };
    }
  } catch {}
  throw new Error("Spotify credentials missing: copy config/spotify.example.json to config/spotify.json and fill it in");
}

export default class SpotifyAPI {

  static #logger = new Logger("SpotifyAPI");
  /** @type {string | undefined} */
  static #accessToken;
  /** epoch ms after which the token must be refreshed */
  static #accessTokenExpiresAt = 0;
  /** @type {FetchAPI<SpotifyAPIEndPointsMap>} */
  static #api = new FetchAPI("https://api.spotify.com/v1");

  static async acquireAccessToken(force = false) {
    if(this.#accessToken !== undefined && !force && Date.now() < this.#accessTokenExpiresAt) {
      return;
    }
    try {
      const { clientId, clientSecret } = loadCredentials();
      const response = await net.fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret
        }).toString()
      });
      /** @type {{ access_token: string; expires_in: number } | { error: string; error_description?: string }} */
      const json = await response.json();
      if("error" in json) {
        throw new Error(json.error_description ?? json.error);
      }
      this.#accessToken = json.access_token;
      // refresh a minute early
      this.#accessTokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000;
      this.#api.setDefaultRequestInit({
        headers: {
          Authorization: `Bearer ${ this.#accessToken }`
        }
      });
    } catch(ex) {
      this.#logger.error("Failed to get access token:", ex);
      throw new Error(`Spotify API error: ${ ex.message }`);
    }
  }

  /** @param {string} isrc */
  static async getTracksByISRC(isrc) {
    const result = await this.#api.get("/search", {
      type: "track",
      q: `isrc:${isrc}`
    });
    if (result.error) {
      throw new Error(`Spotify API error: ${result.error.message}`);
    }
    this.#validateResponseResult(result);
    if (result.tracks.items.length === 0) {
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
    if (result.tracks.items.length === 0) {
      return null;
    }
    return result.tracks.items[0];
  }

  static #validateResponseResult(response) {
    if (response.error) {
      throw new Error(`Spotify API error: ${response.error.message}`);
    }
  }

};