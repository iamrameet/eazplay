const { dataList, listItem } = await eazuse(import.meta.resolve("./lists.html"));
import DataStore from "../../modules/data-store.js";
import ElementsBuilder from "../../modules/elements-builder.js";
import { fnBind } from "../../modules/util.js";

/** @typedef {{ [fieldName: string]: typeof HTMLElement }} ItemStructure */
/**
 * @template {ItemStructure} T
 * @typedef {{ [K in keyof T]: InstanceType<T[K]> }} StructuredItem */

/** @template {"data:getTracks" | "data:getTracksByArtist"} N */
export class DataList extends HTMLElement {

  static #scrollTimeout = 50;
  static #scrollMaxTime = 200;

  #itemsElement;
  #placeholderElement;
  /** @type {number | undefined} */
  #scrollStartTime;
  /** @type {NodeJS.Timeout} */
  #scrollTimeoutId = null;
  #store;
  /** @type {Parameters<typeof electronAPI.invoke<N>>[1] & { offset: never; limit: never }} */
  extraData = {};

  /**
   * @param {DataStore<typeof Data.tracks, "path">} store
   * @param {N} dataChannelName
   * @param {number} size items count
   */
  constructor(store, dataChannelName, size) {
    super();
    this.#store = store;
    if(dataChannelName) {
      this.dataChannelName = dataChannelName;
    }
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(dataList.content.cloneNode(true));
    if(size) {
      this.size = size;
    }
    this.#itemsElement = this.shadowRoot.getElementById("items");
    this.#placeholderElement = this.shadowRoot.getElementById("placeholder");

    const requestItems = () => {
      scrollStartTime = undefined;
      // const scrollPercent = Math.round(this.scrollTop / (this.scrollHeight - this.clientHeight) * 100) / 100;
      const { scrollTop } = this;
      const offset = Math.floor(scrollTop * this.size / this.scrollHeight);
      const itemsCount = Math.ceil(this.clientHeight * this.size / this.scrollHeight);
      this.dispatchEvent(new CustomEvent("item-request", {
        detail: { itemsCount, offset, scrollTop }
      }));
    };

    this.addEventListener("scroll", () => {
      const currentTime = Date.now();
      if(this.#scrollStartTime === undefined) {
        this.#scrollStartTime = currentTime;
      }
      if(currentTime - this.#scrollStartTime < DataList.#scrollMaxTime) {
        clearTimeout(this.#scrollTimeoutId);
      }
      this.#scrollTimeoutId = setTimeout(() => this.requestItems(), DataList.#scrollTimeout);
    });
  }

  get size() {
    return Number.parseInt(this.getAttribute("size") ?? "0");
  }
  set size(value) {
    this.setAttribute("size", value);
    this.#itemsElement.style.height = `calc(5rem * ${ value })`;
  }

  get store() {
    return this.#store;
  }

  /** @returns {N} */
  get dataChannelName() {
    return this.getAttribute("channel-name");
  }
  set dataChannelName(value) {
    this.setAttribute("channel-name", value);
  }

  set store(store) {
    this.#store = store;
  }

  get placeholderElement() {
    return this.#placeholderElement;
  }

  get offset() {
    return Math.floor(this.scrollTop * this.size / this.scrollHeight);
  }

  connectedCallback() {
    this.requestItems();
  }

  requestItems() {
    this.#scrollStartTime = undefined;
    // const scrollPercent = Math.round(this.scrollTop / (this.scrollHeight - this.clientHeight) * 100) / 100;
    const { scrollTop } = this;
    const offset = Math.floor(scrollTop * this.size / this.scrollHeight);
    const itemsCount = Math.ceil(this.clientHeight * this.size / this.scrollHeight);
    this.#loadItems(itemsCount, offset);
  }

  clearItems() {
    const children = Array.from(this.children).filter(element => element instanceof ListItem);
    for(const element of children) {
      element.remove();
    }
  }

  /**
   * @param {number} itemsCount
   * @param {number} offset
   */
  async #loadItems(itemsCount, offset) {
    if(!this.dataChannelName) {
      return;
    }
    /** @type {ListItem[]} */
    const children = Array.from(this.children).filter(element => element instanceof ListItem);
    const tracks = await electronAPI.invoke(this.dataChannelName, {
      offset,
      limit: itemsCount,
      ...this.extraData
    });
    const tracksPath = new Set(tracks.map(track => track.path));
    let removed = 0;
    for(const element of children) {
      if(!tracksPath.has(element.track?.path)) {
        this.#store.releaseItem(this, element.track?.path);
        // console.log(element.track.path, "removed");
        element.remove();
        removed++;
      }
    }

    for(const [index, trackData] of tracks.entries()) {
      const listItem = new ListItem;
      listItem.id = "track-li-" + trackData.path;
      listItem.style.top = `calc(5rem * ${ offset + index })`;
      const existingListItem = this.children.namedItem(listItem.id);
      if(existingListItem !== null) {
        continue;
      }
      if(index === 0) {
        this.prepend(listItem);
      } else if(this.children.length === 0) {
        this.append(listItem);
      } else {
        this.children.item(index - 1).after(listItem);
      }
      // this.dispatchEvent(new CustomEvent("item-request", {
      //   detail: { itemsCount, offset, scrollTop }
      // }));
      this.#store.setItem(trackData);
      const track = this.#store.requestItem(this, trackData.path);
      listItem.track = track;
      TrackQueues.getQueue("songsList").push(track);
    }

  }

  /** Only for util
   * @param {DataList} instance */
  static getTemplates(instance) {
    return [ `"${ instance.dataChannelName }"` ];
  }

};

const Span = ElementsBuilder.single("span");
const SimpleButton = ElementsBuilder.extended("button",
  /**
   * @param {string} textContent
   * @param {ListenerCollection<HTMLButtonElement>["click"]} onclick
   */
  function(textContent, onclick) {
    return [{
      textContent,
      $listeners: { click: onclick }
    }];
  }
);

/** @typedef {Awaited<ReturnType<typeof electronAPI.invoke<"folders:structures">>>["tracks"]} TrackStructure */
/** @typedef {{ togglePlayback: boolean | undefined; playbackState: "playing" | "paused" | "ended"; activeQueue: { queueId: string }; download: null; downloadState: "progress" | "done" | "idle"; showArtist: { artistIndex: number }; showAlbum: any }} TrackChannelsMap */
/** @typedef {import("../../modules/data-handler").DataHandlerItemWrapper<TrackStructure, TrackChannelsMap>} TrackHandlerItem */

export class ListItem extends HTMLElement {

  #track;
  #updateHandler;
  #messageHandler;

  /** @param {TrackHandlerItem} track */
  constructor(track) {
    super();
    this.#track = track;
    this.#updateHandler = fnBind(this.#updateHandlerDefinition, this);
    this.#messageHandler = fnBind(this.#messageHandlerDefinition, this);

    this.attachShadow({ mode: "open" });
    this.style.visibility = "hidden";
    this.shadowRoot.appendChild(listItem.content.cloneNode(true));
    const resources = this.shadowRoot.querySelectorAll("link");
    let promises = Array.from(resources).map(resource => resource.until("load"));
    Promise.all(promises).then(() => {
      this.style.visibility = "visible";
    });

    const { toggle, spotifyButton, downloadButton } = this.elements;

    if(track) {
      this.#setTrack(track);
    } else {
      this.toggleAttribute("is-placeholder", true);
    }

    toggle.explicit.addEventListener("click", () => {
      const explicit = !this.#track.explicit;
      if(this.#track.$self.update({ explicit })) {
        this.ownerDocument.getElementById("alertPanel").success(explicit ? "Marked as explicit" : "Unmarked as explicit");
      }
    });

    toggle.like.addEventListener("click", () => {
      const liked = !this.#track.liked;
      if(this.#track.$self.update({ liked })) {
        this.ownerDocument.getElementById("alertPanel").success(liked ? "Added to liked playlist" : "Removed from liked playlist");
      }
    });

    toggle.playback.addEventListener("click", () => {
      this.#track.$self.send("activeQueue", { queueId: this.parentElement.id });
    });

    spotifyButton.addEventListener("click", () => {
      location.href = `https://open.spotify.com/track/${ this.#track.externalRefs.spotify }`;
    });

    downloadButton.addEventListener("click", () => {
      this.#track.$self.send("download");
    });

    this.addEventListener("click", event => {
      if(event.currentTarget === this && this.hasAttribute("playback-state")) {
        const sibling = this.previousElementSibling ?? this.nextElementSibling;
        sibling?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

  }

  get track() {
    return this.#track;
  }

  set track(value) {
    this.disconnectedCallback();
    this.#track = value;
    this.#setTrack(value);
    this.connectedCallback();
  }

  /** @param {this["track"]} track */
  #setTrack(track) {
    const { albumArt, toggle, spotifyButton, downloadButton } = this.elements;
    albumArt.src = track.album.thumbnails?.x80;
    const trackTitle = track.title ?? (pathname => {
      return pathname.substring(pathname.lastIndexOf("/") + 1, pathname.lastIndexOf("."));
    })(decodeURIComponent(new URL(track.path).pathname))
    this.append(
      new Span({ slot: "title", innerText: trackTitle }),
      new Span({
        slot: "album",
        appendChild: new SimpleButton(track.album.title ?? "Unknown", () => void track.$self.send("showAlbum"))
      }),
      new Span({
        slot: "artist",
        append: track.artists.length === 0 ? [ "Unknown" ] : track.artists.map((artist, index) => {
          return [
            new SimpleButton(artist.name ?? "Unknown", function() {
              track.$self.send("showArtist", { artistIndex: index });
            }),
            new Text(index === track.artists.length - 1 ? "" : ", ")
          ];
        }).flat()
      }),
      new Span({
        slot: "duration",
        textContent: readableSeconds(track.duration)
      })
    );
    if(track.lossless) {
      this.classList.add("high-quality");
    }
    toggle.like.classList.toggle("active", track.liked ?? false);
    toggle.explicit.classList.toggle("active", track.explicit ?? false);
    if(track.externalRefs.spotify === undefined) {
      spotifyButton.style.display = "none";
    }
    if(track.externalRefs.spotify === undefined && track.externalRefs.isrc === undefined) {
      downloadButton.style.display = "none";
    }
    this.toggleAttribute("is-placeholder", false);
  }

  get elements() {
    /** @type {HTMLImageElement} */
    const albumArt = this.shadowRoot.getElementById("albumArt");
    /** @type {HTMLButtonElement} */
    const spotifyButton = this.shadowRoot.getElementById("spotifyButton");
    /** @type {HTMLButtonElement} */
    const downloadButton = this.shadowRoot.getElementById("downloadButton");
    const toggle = {
      /** @type {HTMLButtonElement} */
      playback: this.shadowRoot.getElementById("togglePlayback"),
      /** @type {HTMLButtonElement} */
      explicit: this.shadowRoot.getElementById("toggleExplicit"),
      /** @type {HTMLButtonElement} */
      like: this.shadowRoot.getElementById("toggleLike")
    };
    return { albumArt, toggle, spotifyButton, downloadButton };
  }

  get previousSiblingTrack() {
    const sibling = this.previousElementSibling;
    if(sibling instanceof ListItem) {
      return sibling.#track;
    }
    return null;
  }

  get nextSiblingTrack() {
    const sibling = this.nextElementSibling;
    if(sibling instanceof ListItem) {
      return sibling.#track;
    }
    return null;
  }

  /** @returns {Generator<[ index: number, track: TrackHandlerItem, self: boolean ]>} */
  *siblingTracks() {
    for(const [index, sibling] of Array.from(this.parentElement?.children ?? []).entries()) {
      if(sibling instanceof ListItem) {
        yield [index, sibling.#track, sibling === this];
      }
    }
  }

  cloneNode() {
    return new ListItem(this.#track);
  }

  connectedCallback() {
    if(this.#track) {
      this.#track.$self.on("update", this.#updateHandler);
      this.#track.$self.on("message", this.#messageHandler);
      this.#track.$self.on("remove", () => {
        console.log("removed");
      });
    }
  }

  disconnectedCallback() {
    this.removeAttribute("playback-state");
    if(this.#track) {
      this.#track.$self.off("update", this.#updateHandler);
      this.#track.$self.off("message", this.#messageHandler);
    }
  }

  /** @param {import("../../modules/extended-event.js").ExtendedEvent<import("../../modules/data-handler.js").DataHandlerItemEventMap<TrackStructure, TrackChannelsMap>["update"]>} event  */
  #updateHandlerDefinition(event) {
    if("liked" in event.data) {
      this.elements.toggle.like.classList.toggle("active", event.data.liked);
    }
    if("explicit" in event.data) {
      this.elements.toggle.explicit.classList.toggle("active", event.data.explicit);
    }
  }

  /** @param {import("../../modules/extended-event.js").ExtendedEvent<import("../../modules/data-handler.js").DataHandlerItemEventMap<TrackStructure, TrackChannelsMap>["message"]>} event  */
  #messageHandlerDefinition(event) {
    console.log(event.data);
    switch(event.data.channel) {
      case "playbackState":
        switch(event.data.message) {
          case "ended":
            this.removeAttribute("playback-state");
          break;
          default:
            this.setAttribute("playback-state", event.data.message);
        }
      break;
      case "downloadState":
        this.setAttribute("download-state", event.data.message);
    }
  }

};

/** @param {number} totalSeconds */
function readableSeconds(totalSeconds) {              // 3723
  const seconds = Number.parseInt(totalSeconds) % 60; // 3723 % 60 = 3
  const totalMinutes = Math.floor(totalSeconds / 60); // 3723 / 60 = 62
  const minutes = totalMinutes % 60;                   // 62 % 60 = 2
  const totalHours = Math.floor(totalMinutes / 60);    // 62 / 60 = 1
  return (`${
    totalHours > 0 ? `${ totalHours.toString().padStart(2, "0") }:` : ""
  }${
    minutes.toString().padStart(2, "0")
  }:${
    seconds.toString().padStart(2, "0")
  }`);
}