import fs from "node:fs/promises";
import { extendError } from "../common/error.js";
import NodePath from "node:path";
import MusicMetadata from "music-metadata/lib/core.js";
import { nativeImage as NativeImage, net } from "electron";
import path from "node:path";
import { construct } from "../common/util.js";
import { URL } from "node:url";
import appConfig from "../config.json" with { type: "json" };
import Logger from "../library/logger.js";

export default class MediaFileSystem {


  static Error = extendError();
  static fileTypes = Object.freeze(new Set(/** @type {const} */([ ".mp3", ".wav", ".aac", ".flac", ".ogg", ".amr" ])));

  static #thumbnailSizes = Object.freeze(/** @type {const} */ ([80]));
  /** @type {{ original: string } & { [K in typeof MediaFileSystem.thumbnailSizes[number] as `x${ K }`]: string }} */
  static #thumbnailPath = {};
  /** @type {string} */
  static #lyricsPath;

  static #artFilenameGenerator;

  static get nextArtFilename() {
    return this.#artFilenameGenerator.next().value;
  }

  /** @param {string[]} paths */
  static async setThumbnailPath(...paths) {
    this.#thumbnailPath = {
      original: path.join(...paths, "original")
    };
    for(const thumbnailSize of this.#thumbnailSizes) {
      const sizeName = "x" + thumbnailSize;
      this.#thumbnailPath[sizeName] = path.join(...paths, sizeName);
    }
    for(const path of Object.values(this.#thumbnailPath)) {
      await fs.mkdir(path, { recursive: true });
    }
  }

  /** @param {string} path */
  static async setLyricsPath(path) {
    await fs.mkdir(path, { recursive: true });
    this.#lyricsPath = path;
  }

  static get thumbnailSizes() {
    return this.#thumbnailSizes;
  }

  static async findFiles(path) {

    try {
      /** @type {import("node:fs").Dirent[]} */
      const directories = await fs.readdir(path, {
        recursive: true,
        withFileTypes: [ "audio/mpeg", "audio/wav" ]
      });

      return directories.filter(dirent => dirent.isFile());
    } catch(ex) {
      throw new MediaFileSystem.Error(ex, "Unable to find files");
    }

  }

  /**
   * @param {string} path
   * @param {Array<string>} filePaths
   * @param {Array<string>} directoryPaths
  */
  static async #readDir(path, filePaths, directoryPaths) {
    const dirents = await fs.readdir(path, { recursive: false, withFileTypes: true });
    let pastFilesCount = filePaths.length;
    for(const dirent of dirents) {
      const direntPath = NodePath.join(dirent.path, dirent.name);
      // console.log(fullPath);
      if(dirent.isFile()) {
        if(this.fileTypes.has(NodePath.extname(dirent.name))) {
          filePaths.push(direntPath);
        }
      } else if(dirent.isDirectory()) {
        directoryPaths.push(direntPath);
      }
    }
    return filePaths.length - pastFilesCount;
  }

  static async getStats(path) {
    try {
      return await fs.stat(path, { bigint: false });
    } catch(ex) {
      throw new this.Error(ex, `Unable to get Stats '${ path }'`);
    }
  }

  /** @param {(directoriesCount: number, foundFilesCount: number, allFoundFilesCount: number)} onprogress */
  static async findRecursively(path, onprogress = null) {

    try {

      const filePaths = [];
      const skippedDirectories = [];

      const directoryPaths = [ path ];

      while(directoryPaths.length !== 0) {
        const directoryPath = directoryPaths.pop();
        try {
          const foundFilesCount = await this.#readDir(directoryPath, filePaths, directoryPaths);
          onprogress?.(directoryPaths.length, foundFilesCount, filePaths.length);
        } catch(reason) {
          skippedDirectories.push({
            path: directoryPath,
            reason
          });
        }
      }

      return { filePaths, skippedDirectories };
    } catch(ex) {
      throw new MediaFileSystem.Error(ex, "Failed to read directory");
    }

  }

  /** @param {string} filepath */
  static async getMetaData(filepath, throwOnException = true) {
    try {
      const buffer = await fs.readFile(filepath);
      const metadata = await MusicMetadata.parseBuffer(buffer);
      return {
        path: filepath,
        title: metadata.common.title,
        albumArtist: metadata.common.albumartist?.split(/;|,|&|\||ft\.|feat\./, 1)[0].replace(/\(|\)/, "").trim(),
        artists: (metadata.common.artist?.split(",") ?? []).flatMap(artist => artist.split(/;|,|&|\||ft\.|feat\./).map(artist => artist.replace(/\(|\)/, "").trim())),
        album: metadata.common.album?.trim(),
        year: metadata.common.year,
        lyrics: metadata.common.lyrics ?? [],
        picture: metadata.common.picture ?? [],
        format: metadata.format
      };
    } catch(ex) {
      if(throwOnException) {
        throw new this.Error(ex, `Unable to get metadata for file '${ filepath }'`);
      }
      return {};
    }
  }

  static async readFile(filepath) {
    try {
      return await fs.readFile(filepath);
    } catch(ex) {
      throw new this.Error(ex, `Unable to read file '${ filepath }'`);
    }
  }

  static {
    this.#artFilenameGenerator = (function *() {
      let counter = 0;
      while(true) {
        yield construct(Date).getTime().toString(36) + counter + ".jpeg";
      }
    })()
  }

  /** @param {string} url */
  static async fetchImageAsBuffer(url) {
    try {
      const response = await net.fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch(ex) {
      Logger.error("MediaFileSystem.fetchImageAsBuffer", ex);
      return Buffer.alloc(0);
    }
  }

  /**
   * @param {string} name `name`.png
   * @param {Buffer} buffer
  */
  static async saveAlbumArt(name, buffer) {
    const { nextArtFilename } = this;
    try {
      const originalPath = path.join(this.#thumbnailPath.original, nextArtFilename);
      await fs.writeFile(originalPath, buffer, { encoding: "binary" });
      /** @type {{ [K in typeof MediaFileSystem.thumbnailSizes[number] as `x${ K }`]: string }} */
      const thumbnails = {};
      const nativeImage = NativeImage.createFromBuffer(buffer);
      for(const thumbnailSize of this.#thumbnailSizes) {
        const sizeName = "x" + thumbnailSize;
        thumbnails[sizeName] = path.join(this.#thumbnailPath[sizeName], nextArtFilename);
        const resizedBuffer = nativeImage.resize({ width: thumbnailSize, height: thumbnailSize });
        await fs.writeFile(thumbnails[sizeName], resizedBuffer.toJPEG(100), { encoding: "binary" });
      }
      return { albumArt: originalPath, thumbnails };
    } catch(ex) {
      throw new this.Error(ex, `Unable to save album art for ${ name }`)
    }
  }

  static async deleteThumbnailPath() {
    for(const key in this.#thumbnailPath) {
      console.log(this.#thumbnailPath[key]);
      await fs.rm(this.#thumbnailPath[key], { recursive: true });
    }
  }

  /** @param {string} name */
  static async fetchArtistImage(name) {
    try {
      const response = await net.fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${ name }&prop=pageimages&format=json&pithumbsize=400`, { method: "GET" });
      /** @type {{ query: { pages: { [pageId: string]: { pageid: string; ns: number; title: string; pageimage: string; thumbnail?: { source: string; width: number; height: number; } } } } }} */
      const apiResponse = await response.json();
      const pages = Object.values(apiResponse.query.pages);
      if(pages.length === 0) {
        throw new Error(`No pages were found for the specified artist '${ name }'`);
      }
      if("thumbnail" in pages[0] === false) {
        throw new Error(`No thumbnails were found for the specified artist '${ name }'`);
      }
      return pages[0].thumbnail.source;
    } catch(ex) {
      console.log(ex);
      return "assets/images/default-artist.jpeg";
    }
  }

  /**
   * @param {string} trackTitle
   * @param {string} artistName
   * @param {string} albumName
   * @param {number} duration
   * @returns {Promise<{ source: string; refId: number; instrumental: boolean; lang: string; isSynced: boolean; lyrics: string; externalRefs: { spotify?: string; deezer?: string; youtube?: string; } }>}
   */
  static async fetchLyrics(trackTitle, artistName, albumName, duration) {
    try {
      const url = new URL("/api/get", "https://lrclib.net");
      url.searchParams.set("track_name", trackTitle);
      url.searchParams.set("artist_name", artistName);
      url.searchParams.set("album_name", albumName);
      url.searchParams.set("duration", duration);
      console.log(url.href);
      const response = await net.fetch(url, {
        headers: {
          "User-Agent": `${ appConfig.title } ${ appConfig.version } (${ appConfig.url })`
        }
      });
      const data = await response.json();
      if(!response.ok) {
        throw data;
      }
      const externalRefs = {};
      if(data.spotifyId) {
        externalRefs.spotify = data.spotifyId;
      }
      return {
        source: "lrclib",
        refId: data.id,
        instrumental: data.instrumental,
        lang: data.lang,
        isSynced: data.syncedLyrics !== null,
        lyrics: data.syncedLyrics ?? data.plainLyrics ?? "",
        externalRefs
      };
    } catch(ex) {
      throw ex?.message;
    }
  }

  /**
   * @param {string} data
   * @param {".lrc" | ".txt"} fileExtension
   */
  static async saveLyrics(data, fileExtension = ".txt") {
    const filename = `${ Date.now().toString(36) }${ fileExtension }`;
    try {
      await fs.writeFile(NodePath.join(this.#lyricsPath, filename), data, { encoding: "utf-8" });
      return { filename };
    } catch(ex) {
      throw ex;
    }
  }

  /** @param {string} filename */
  static async loadLyrics(filename) {
    try {
      return await fs.readFile(NodePath.join(this.#lyricsPath, filename), { encoding: "utf-8" });
    } catch(ex) {
      throw ex;
    }
  }

  /** @param {string} trackId */
  static async spotifyDownloadLink(trackId) {
    const url = `https://api.spotidownloader.com/download`;
    try {
      const response = await net.fetch(url, {
        method: "POST",
        headers: {
          'authority': 'api.spotifydown.com',
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'max-age=0',
          'if-none-match': 'W/"1be-SjBQ4eFjKqYSr5iIRSrb0pRQvq0"',
          'origin': 'https://spotifydown.com',
          'referer': 'https://spotifydown.com/',
          'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Microsoft Edge";v="122")',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0'
        }
      });
      const data = await response.json();
      if(!data.success) {
        throw data.message;
      }
      return data.link;
    } catch(ex) {
      throw ex;
    }
  }

};