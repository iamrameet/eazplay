import Logger from "../library/logger.js";
import { DataManager } from "../managers/index.js";
import { fromEntries, using } from "../common/util.js";
import { IPCControllerTemplate } from "../tools/ipc-controller.js";
import MediaFileSystem from "../tools/media-file-system.js";
import { nativeImage } from "electron";
import Tables, { Views } from "../managers/sqlite3.js";
import { Symbols, Table } from "../library/db.js";
import dataController from "./data.js";

const logger = new Logger("CONTROLLER:FOLDERS");

/** @typedef {{ path: any; title: string | undefined; albumArtist: string | undefined; artists: string[]; album: string | undefined; year: number | undefined; lyrics: string[]; picture: IPicture[] | undefined; }} TrackMetadata */

/**
 * @param {TrackMetadata[]} tracks
 * @param {(index: number, total: number) => void} onprogress
*/
async function getArtistsFromTracksMetadata(tracks, onprogress) {

  /** @type {{ [name: string]: { rowId: number; tracks: Set<string> } }} */
  const artistsMap = {};

  for(const trackMetadata of tracks) {
    if(trackMetadata.albumArtist) {
      const albumArtist = trackMetadata.albumArtist;
      if(albumArtist in artistsMap === false) {
        artistsMap[albumArtist] = { tracks: new Set };
      }
      artistsMap[albumArtist].tracks.add(trackMetadata.path);
    }
    for(const artistName of trackMetadata.artists) {
      if(artistName in artistsMap === false) {
        artistsMap[artistName] = { tracks: new Set };
      }
      artistsMap[artistName].tracks.add(trackMetadata.path);
    }
  }

  const artistKeys = Object.keys(artistsMap);
  const artistsCount = artistKeys.length;
  for(const [index, artistName] of artistKeys.entries()) {
    onprogress(index, artistsCount);
    try {
      const [ artist ] = await Tables.artists.select({
        columns: ["name", "rowid"],
        where: [ Symbols.EQUAL, "name", artistName ]
      });
      if(artist === undefined) {
        artistsMap[artistName].rowId = await Tables.artists.insert({
          name: artistName,
          image: await MediaFileSystem.fetchArtistImage(artistName)
        }, { conflictResolution: "ignore" });
        continue;
      }
      artistsMap[artistName].rowId = artist.rowid;
    } catch(ex) {
      logger.error(`Unable to create artist for ${ artistName }`, ex);
    }
  }

  return artistsMap;

}

/**
 * @param {TrackMetadata[]} tracks
 * @param {(index: number, total: number) => void} onprogress
 */
async function getAlbumsFromTracksMetadata(tracks, onprogress) {

  /** @type {{ [tempId: string]: { rowId: number; id: string; title: string; artist: string; tracks: Set<string>; releaseDate: number | undefined; picture: import("music-metadata").IPicture; format: import("music-metadata").IFormat } }} */
  const albumsMap = {};

  for(const trackMetadata of tracks) {
    const albumTempId = (trackMetadata.album ?? "") + (trackMetadata.albumArtist ?? trackMetadata.artists.slice().sort().join("-"));
    trackMetadata.albumTempId = albumTempId;
    if(albumTempId in albumsMap === false) {
      albumsMap[albumTempId] = {
        title: trackMetadata.album,
        releaseDate: trackMetadata.year,
        picture: trackMetadata.picture[0],
        artist: trackMetadata.albumArtist,
        tracks: new Set
      };
    }
    albumsMap[albumTempId].tracks.add(trackMetadata.path);
  }

  const albumKeys = Object.keys(albumsMap);
  const albumsCount = albumKeys.length;
  for(const [index, albumTempId] of albumKeys.entries()) {
    onprogress(index, albumsCount);
    try {
      const albumArt = await using(albumsMap[albumTempId].picture, async function() {
        return await MediaFileSystem.saveAlbumArt(albumsMap[albumTempId].title, this.data);
      });
      albumsMap[albumTempId].rowId = await Tables.albums.insert({
        title: albumsMap[albumTempId].title,
        artist: Tables.artists.selectSubQuery("rowid", {
          where: [ Symbols.EQUAL, "name", albumsMap[albumTempId].artist ]
        }),
        releaseDate: albumsMap[albumTempId].releaseDate,
        art: albumArt?.albumArt,
        thumbnails: albumArt?.thumbnails
      }, { conflictResolution: "ignore" });
    } catch(ex) {
      logger.error(`Unable to create album for ${ albumTempId }`, ex);
    }
  }

  return albumsMap;

}

export const foldersController = new IPCControllerTemplate({

  async structures() {
    return {
      directories: Tables.directories.structure,
      tracks: await Views.tracks.getStructure(),
      artists: await Views.artists.getStructure(),
      albums: await Views.albums.getStructure()
    }
  },

  async database() {
    const data = {
      directories: await Tables.directories.select(),
      tracks: await Views.tracks.all(),
      artists: await Views.artists.all(),
      albums: await Views.albums.all(),
      trackArtists: await Tables.trackArtists.select(),
      als: await Tables.albums.select(),
      ars: await Tables.artists.select({ columns: ["rowid", "name"] }),
      trks: await Tables.tracks.select(),
    };
    return data;
  },

  async resetDatabase() {
    try {
      await Tables.directories.truncate();
      await Tables.tracks.truncate();
      await Tables.artists.truncate();
      await Tables.albums.truncate();
      await MediaFileSystem.deleteThumbnailPath();
      return true;
    } catch(ex) {
      logger.error(ex);
      return false;
    }
  },

  async scan(event, path) {
    try {
      const dirStat = await MediaFileSystem.getStats(path);
      let [directory] = await Tables.directories.select({
        limit: 1,
        rawWhere: true,
        where: `'${ path }' LIKE path || '%'`
      });
      if(directory === undefined) {
        await Tables.directories.insert({ path });
        directory = await Tables.directories.get(path);
      } else if(false && dirStat.mtime.getTime() < directory.updatedAt.getTime()) {
        event.ipcMainEvent.sender.send("folders:scan:progress", { path, type: "scan", current: 1, total: 4 }, 0, 0);
        return [];
      }
      const { filePaths } = await MediaFileSystem.findRecursively(path);
      const { length: filesCount } = filePaths;
      const tracksMetadata = [];
      const count = await Tables.tracks.delete({
        where: [
          Symbols.AND, [
            [ Symbols.LIKE, "path", `${ path }%` ],
            [ Symbols.NOTIN, "path", filePaths ]
          ]
        ]
      });
      logger.log(`${ count } tracks removed`);
      for(const [index, filepath] of filePaths.entries()) {
        const track = await Tables.tracks.getBy("path", filepath);
        if(track) {
          continue;
        }
        event.ipcMainEvent.sender.send("folders:scan:progress", { path, type: "scan", current: 1, total: 4 }, index + 1, filesCount);

        // try getting MetaData
        try {
          const metadata = await MediaFileSystem.getMetaData(filepath);
          tracksMetadata.push(metadata);
          logger.log(`Loaded metadata for file "${ filepath }"`);
        } catch(ex) {
          logger.log(ex.message);
        }

      }
      // event.ipcMainEvent.sender.send("folders:scan:progress", filesCount, filesCount);
      const artistsMap = await getArtistsFromTracksMetadata(tracksMetadata, (index, total) => {
        event.ipcMainEvent.sender.send("folders:scan:progress", { path, type: "artists", current: 2, total: 4 }, index + 1, total);
      });
      const albumsMap = await getAlbumsFromTracksMetadata(tracksMetadata, (index, total) => {
        event.ipcMainEvent.sender.send("folders:scan:progress", { path, type: "albums", current: 3, total: 4 }, index + 1, total);
      });
      const tracksMetadataCount = tracksMetadata.length;
      for(const [index, trackMetadata] of tracksMetadata.entries()) {
        event.ipcMainEvent.sender.send("folders:scan:progress", { path, type: "tracks", current: 4, total: 4 }, index + 1, tracksMetadataCount);
        await Tables.tracks.insert({
          path: trackMetadata.path,
          title: trackMetadata.title,
          album: albumsMap[trackMetadata.albumTempId]?.rowId,
          duration: trackMetadata.format.duration,
          bitrate: trackMetadata.format.bitrate,
          sampleRate: trackMetadata.format.sampleRate,
          lossless: trackMetadata.format.lossless,
          channels: trackMetadata.format.numberOfChannels,
          codec: {
            container: trackMetadata.format.container,
            encoder: trackMetadata.format.codec
          }
        });
      }
      for(const artistName in artistsMap) {
        for(const trackPath of artistsMap[artistName].tracks) {
          await Tables.trackArtists.insert({
            artistId: artistsMap[artistName].rowId,
            trackPath
          }, { conflictResolution: "ignore" });
        }
      }
      await Tables.directories.update({ updatedAt: Date.now() }, {
        where: [ Symbols.EQUAL, "path", directory.path ]
      });
      return tracksMetadata;
    } catch(ex) {
      logger.log(ex);
      return [];
    }
  },

  /**
   * @param {string} path
   * @param {import("../library/db.js").ColumnValues<typeof Tables.tracks["columns"]>} fields */
  async updateTrack(event, path, fields) {
    console.log(path, fields)
    await Tables.tracks.updateBy("path", path, fields);
    return await Tables.tracks.get(path);
  },

  /** @param {string} path */
  async audioBuffer(event, path) {
    return await MediaFileSystem.readFile(path);
  },

  async imageBuffer(event, path) {
    const image = nativeImage.createFromPath(path);
    return image.toPNG();
  },

  /** @param {string} trackId */
  async fetchLyrics(event, trackId) {
    const track = await dataController.channels.getTrackById(event, trackId);
    if(track === undefined) {
      throw "Track not found";
    }
    const { title, album, duration, lyrics } = track;
    if(lyrics.filename) {
      return {
        lyrics: await MediaFileSystem.loadLyrics(lyrics.filename),
        info: lyrics
      };
    }

    const filteredArtists = track.artists.map(artist => artist.name).join(", ");
    const lyricsData = await MediaFileSystem.fetchLyrics(title, filteredArtists, track.album.title, duration);
    const { filename } = await MediaFileSystem.saveLyrics(lyricsData.lyrics, lyricsData.isSynced ? ".lrc" : ".txt");

    const lyricsUpdate = {
      filename: filename,
      instrumental: lyricsData.instrumental,
      isSynced: lyricsData.isSynced,
      source: lyricsData.source,
      sourceRef: lyricsData.refId,
      language: lyricsData.lang,
    };
    await Tables.tracks.updateBy("rowid", track.rowid, {
      lyrics: lyricsUpdate,
      externalRefs: {
        spotify: lyricsData.externalRefs.spotify
      }
    });
    return {
      info: lyricsUpdate,
      lyrics: lyricsData.lyrics
    };
  },

  /** @param {String} filename */
  async readLyrics(event, filename) {
    return await MediaFileSystem.loadLyrics(filename);
  }

});