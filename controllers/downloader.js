import { nativeImage as NativeImage, net } from "electron";
import { IPCControllerTemplate } from "../tools/ipc-controller.js";
import MediaFileSystem from "../tools/media-file-system.js";
import { createWriteStream } from "node:fs";
import NodePath from "node:path";
import Tables from "../managers/sqlite3.js";
import SpotifyAPI from "../apis/spotify.js";
import Logger from "../library/logger.js";
import { Table } from "../library/db.js";

await SpotifyAPI.acquireAccessToken().catch(console.log);

const logger = new Logger("DOWNLOADER");

const downloadsController = new IPCControllerTemplate({

  /**
   * @param {string} trackId
   * @param {{ title: string; artists: { name: string; image: string; }[]; album: { title: string; artist: { name: string; image: string; }; art: string; releaseDate?: string }; explicit?: boolean; externalRefs: ReturnType<typeof Tables.tracks.columns.externalRefs.parse> }} trackData
   */
  async spotify(event, trackId, trackData) {
    try {
      const url = await MediaFileSystem.spotifyDownloadLink(trackId);
      const response = await net.fetch(url);
      if(!response.ok) {
        throw new Error(`Cannot get audio, ${ response.statusText }`);
      }
      const downloadsDirPath = event.app.getPath("downloads");
      const contentLength = Number.parseInt(response.headers.get("content-length"));
      const filename = response.headers.get("content-disposition")?.match(/filename="(.+?)"/)[1] ?? `audio-${ Date.now() }.mp3`;
      const filepath = NodePath.join(downloadsDirPath, filename);
      const writeStream = createWriteStream(filepath, { encoding: "binary" });
      const reader = response.body.getReader();
      console.log(filepath, filename);

      let downloadedSize = 0;
      let lastReadAt = Date.now();
      let downloadSizeForInterval = 0;
      while(true) {
        const readResult = await reader.read();
        if(readResult.done) {
          break;
        }
        downloadedSize += readResult.value.byteLength;
        downloadSizeForInterval += readResult.value.byteLength;
        const currentTime = Date.now();
        /** in `ms` */
        const timeDifference = Math.max(1, currentTime - lastReadAt);
        if(timeDifference > 1000) {
          lastReadAt = currentTime;
          const totalSize = Number.isNaN(contentLength) ? downloadedSize : contentLength;
          event.ipcMainEvent.sender.send("downloader:spotify:progress", {
            trackId,
            filepath,
            totalSize,
            downloadedSize,
            /** in `B/ms` */
            speed: downloadSizeForInterval / timeDifference
          });
          downloadSizeForInterval = 0;
        }
        await new Promise((resolve, reject) => {
          writeStream.write(readResult.value, error => error instanceof Error ? reject(error) : resolve());
        });
      }
      writeStream.close();
      const albumArtistId = await Tables.artists.insert(trackData.album.artist);
      const albumArtBuffer = await MediaFileSystem.fetchImageAsBuffer(trackData.album.art);
      const albumArt = await MediaFileSystem.saveAlbumArt(trackData.album.title, albumArtBuffer);
      const artistsId = await Promise.all(trackData.artists.map(artist => Tables.artists.insert(artist)));
      const albumId = await Tables.albums.insert({
        title: trackData.album.title,
        art: albumArt.albumArt,
        artist: albumArtistId,
        releaseDate: trackData.album.releaseDate,
        thumbnails: albumArt.thumbnails
      });
      const trackMetadata = await MediaFileSystem.getMetaData(filepath, true);
      await Tables.tracks.insert({
        path: filepath,
        // path: trackMetadata.path,
        album: albumId,
        title: trackData.title ?? trackMetadata?.title,
        duration: trackMetadata?.format?.duration,
        bitrate: trackMetadata?.format?.bitrate,
        sampleRate: trackMetadata?.format?.sampleRate,
        lossless: trackMetadata?.format?.lossless,
        channels: trackMetadata?.format?.numberOfChannels,
        codec: {
          container: trackMetadata?.format?.container,
          encoder: trackMetadata?.format?.codec
        },
        explicit: trackData.explicit,
        externalRefs: trackData.externalRefs
      });
      await Tables.trackArtists.insertMany(artistsId.map(artistId => ({ artistId, trackPath: filepath })));
      event.ipcMainEvent.sender.send("downloader:spotify:progress", {
        trackId,
        filepath,
        totalSize: Number.isNaN(contentLength) ? downloadedSize : contentLength,
        downloadedSize: Number.isNaN(contentLength) ? downloadedSize : contentLength,
        speed: 0
      });
    } catch(ex) {
      throw ex;
    }
  },

  /** @param {string} isrc */
  async spotifyByISRC(event, isrc) {
    const [ track ] = await SpotifyAPI.getTracksByISRC(isrc);
    return await this.spotify(event, track.id, {
      title: track.name,
      explicit: track.explicit,
      album: {
        artist: {
          name: track.album.artists[0].name,
          image: track.album.artists[0].href
        },
        art: track.album.images[0]?.url,
        title: track.album.name,
        releaseDate: track.album.release_date
      },
      artists: track.album.artists.map(artist => ({
        name: artist.name,
        image: artist.href
      })),
      externalRefs: {
        spotify: track.id
      }
    });
  }

});

export default downloadsController;