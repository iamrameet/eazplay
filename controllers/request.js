import { net } from "electron";
import { IPCControllerTemplate } from "../tools/ipc-controller.js";

const requestController = new IPCControllerTemplate({

  /**
   * @param {string} name
   * @returns {Promise<{}>}
   */
  async artistByName(event, name) {
    try {
      const url = new URL(`/ws/2/artist`, "https://musicbrainz.org");
      url.searchParams.set("fmt", "json");
      url.searchParams.set("query", name);
      const response = await net.fetch(url);
      const data = await response.json();
      if(!response.ok) {
        throw data.error;
      }
      if(data.count === 0) {
        throw "artist not found";
      }
      return data.artists[0];
    } catch(ex) {
      throw ex;
    }
  },

  /** @param {string} id MusicBrainz Id */
  async artistTracksByMusicBrainzId(event, id) {
    try {
      const url = new URL(`/ws/2/recording`, "https://musicbrainz.org");
      url.searchParams.set("artist", id);
      url.searchParams.set("inc", "url-rels+isrcs");
      url.searchParams.set("fmt", "json");
      const response = await net.fetch(url);
      /** @type {{ "recording-count": number; "recording-offset": number; recordings: { relations: []; isrcs: string[]; title: string; length: number; "first-release-date": string }[] }} */
      const data = await response.json();
      if(!response.ok) {
        throw data.error;
      }
      return data.recordings.filter(recording => recording.title !== "[untitled]").map(recording => {
        return {
          title: recording.title,
          duration: Math.floor(recording.length / 1000 * 100) / 100,
          isrc: recording.isrcs[0]
        };
      });
    } catch(ex) {
      throw ex;
    }
  }

});

export default requestController;