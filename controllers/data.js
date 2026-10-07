/// <reference path="event-maps.d.ts"/>

import { Symbols } from "../library/db.js";
import Tables, { Views } from "../managers/sqlite3.js";
import { IPCControllerTemplate } from "../tools/ipc-controller.js";

const dataController = new IPCControllerTemplate({

  async getCount() {
    return {
      tracks: await Views.tracks.count(),
      likedTracks: await Views.tracks.count([ Symbols.EQUAL, "liked", true ]),
      artists: await Views.artists.count(),
      albums: await Views.albums.count()
    };
  },

  /** @param {{ artistId: string; limit?: number; offset?: number; query?: string }} options */
  async getTracksByArtist(event, options = {}) {
    return await Views.tracks.query`
      SELECT t.rowid, t.path, t.title, t.liked, t.explicit, t.duration, t.bitrate, t.sampleRate, t.codec, t.channels, t.lossless, t.externalRefs, t.lyrics, t.createdAt, t.updatedAt,
        COALESCE(JSON_OBJECT('id', al.rowid, 'title', al.title, 'art', al.art, 'thumbnails', JSON(al.thumbnails)), 'null') AS album,
        COALESCE(JSON_GROUP_ARRAY(JSON_OBJECT('id', a.rowid, 'name', a.name)), '[]') AS artists
        FROM tracks t
        LEFT JOIN albums al ON t.album = al.rowid
        INNER JOIN trackArtists ta ON t.path = ta.trackPath
        INNER JOIN artists a ON ta.artistId = a.rowid
        WHERE ta.artistId = ${ options.artistId } AND t.title LIKE ${ `%${ options?.query ?? "" }%` }
        GROUP BY t.rowid
        LIMIT ${ options?.limit ?? 10 }
        OFFSET ${ options?.offset ?? 0 }
      `;
  },

  /** @param {string} artistId */
  async getTracksCountByArtist(event, artistId, query = "") {
    /** @type {{ count: number }} */
    const record = await Views.tracks.database.get(`
      SELECT COUNT(t.rowid) AS count
        FROM tracks t
        INNER JOIN trackArtists ta ON t.path = ta.trackPath
        INNER JOIN artists a ON ta.artistId = a.rowid
        WHERE ta.artistId = ? AND t.title LIKE ?
    `, [ artistId, `%${ query }%` ]);
    return record.count;
  },

  /** @param {{ albumId: string; limit?: number; offset?: number; query?: string }} options */
  async getTracksByAlbum(event, options = {}) {
    return await Views.tracks.query`
      SELECT t.rowid, t.path, t.title, t.liked, t.explicit, t.duration, t.bitrate, t.sampleRate, t.codec, t.channels, t.lossless, t.externalRefs, t.lyrics, t.createdAt, t.updatedAt,
        COALESCE(JSON_OBJECT('id', al.rowid, 'title', al.title, 'art', al.art, 'thumbnails', JSON(al.thumbnails)), 'null') AS album,
        COALESCE(JSON_GROUP_ARRAY(JSON_OBJECT('id', a.rowid, 'name', a.name)), '[]') AS artists
        FROM tracks t
        LEFT JOIN albums al ON t.album = al.rowid
        INNER JOIN trackArtists ta ON t.path = ta.trackPath
        INNER JOIN artists a ON ta.artistId = a.rowid
        WHERE t.album = ${ options.albumId } AND t.title LIKE ${ `%${ options?.query ?? "" }%` }
        GROUP BY t.rowid
        LIMIT ${ options?.limit ?? 10 }
        OFFSET ${ options?.offset ?? 0 }
      `;
  },

  /** @param {string} albumId */
  async getTracksCountByAlbum(event, albumId, query = "") {
    /** @type {{ count: number }} */
    const record = await Views.tracks.database.get(`SELECT COUNT(rowid) AS count FROM tracks WHERE tracks.album = ? AND tracks.title LIKE ?`, [ albumId, `%${ query }%` ]);
    return record.count;
  },

  /**
   * @param {string} artistId
   * @param {{ query?: string; offset?: number; limit?: number }} options
   */
  async getTracks(event, options = {}) {
    return await Views.tracks.where([
      Symbols.LIKE, "title", `%${ options?.query ?? "" }%`
    ], {
      limit: options?.limit ?? 10,
      offset: options?.offset ?? 0
    });
  },

  /**
   * @param {string} artistId
   * @param {{ offset?: number; limit?: number }} options
   */
  async getLikedTracks(event, options = {}) {
    return await Views.tracks.where([ Symbols.EQUAL, "liked", true ], {
      limit: options?.limit ?? 10,
      offset: options?.offset ?? 0
    });
  },

  async getTrackById(event, trackId) {
    const records =  await Views.tracks.query`
    SELECT t.rowid, t.path, t.title, t.liked, t.explicit, t.duration, t.bitrate, t.sampleRate, t.codec, t.channels, t.lossless, t.externalRefs, t.lyrics, t.createdAt, t.updatedAt,
      COALESCE(JSON_OBJECT('id', al.rowid, 'title', al.title, 'art', al.art, 'thumbnails', JSON(al.thumbnails)), 'null') AS album,
      COALESCE(JSON_GROUP_ARRAY(JSON_OBJECT('id', a.rowid, 'name', a.name)), '[]') AS artists
      FROM tracks t
      LEFT JOIN albums al ON t.album = al.rowid
      INNER JOIN trackArtists ta ON t.path = ta.trackPath
      INNER JOIN artists a ON ta.artistId = a.rowid
      WHERE t.rowid = ${ trackId }
      GROUP BY t.rowid
    `;
    return records[0];
  }

}, /** @type {import("./event-maps.js").DataControllerEventsMap} */ ({}));

export default dataController;