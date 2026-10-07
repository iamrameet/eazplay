import { ConsoleLog, fnBind, fromEntries } from "../../modules/util.js";
import StateQueue from "./state-queue.js";
import ProgressCanvas from "./progress-canvas.js";
import ElementsBuilder from "../../modules/elements-builder.js";
import { NumericRange } from "../../../library/range.js";

const { playerTemplate } = await eazuse(import.meta.resolve("./player.html"));

const Div = ElementsBuilder.single("div");

export class AudioPlayer extends HTMLElement {

  static get observedAttributes() {
    return /** @type {const} */ ([ "src" ]);
  }

  #shadowRoot;
  #audio = new Audio();
  #audioContext = new AudioContext();
  #canvas;
  #playbackQueue = new StateQueue({ circular: true });
  /** @type {import("../lists/lists").TrackHandlerItem[]} */
  #queuedTracks = [];
  /** @type {number} */
  #activeLyricsLine = 0;
  #onTrackUpdate;
  #onTrackSelect;
  #onTrackMessage;

  controlNames = Object.freeze(/** @type {const} */ ([ "playback", "next", "previous", "like", "lyrics" ]));

  constructor() {
    super();

    this.setAttribute("playback-state", "ended");
    // this.#audio.loop = true;

    const fragment = playerTemplate.content;
    this.#shadowRoot = this.attachShadow({ mode: "open", slotAssignment: "named" });
    this.#shadowRoot.appendChild(fragment.cloneNode(true));

    const { playedTime, progressBar, lyricsArea } = this.elements;
    const { controls } = this;

    this.#canvas = new ProgressCanvas({ canvas: progressBar, bar: { margin: 0 } });

    window.addEventListener("resize", () => this.#resizeCanvas());
    this.#forwardEvent(this.#audio, "play");
    this.#onTrackUpdate = fnBind(this.#onTrackUpdateDefinition, this);
    this.#onTrackSelect = fnBind(this.#onTrackSelectDefinition, this);
    this.#onTrackMessage = fnBind(this.#onTrackMessageDefinition, this);

    const observer = new MutationObserver(function(mutations) {
      console.log(mutations)
      if(document.contains(this)) {
        this.#resizeCanvas();
        observer.disconnect();
      }
    });
    observer.observe(this, { attributes: false, childList: true, characterData: false, subtree: true });

    this.#audio.addEventListener("loadedmetadata", async () => {
      const { activeTrack } = this;
      
      const artists = activeTrack.artists.map(artist => artist.name).join(", ");

      this.#loadLyrics(activeTrack);

      const imageBlob = new Blob([ await electronAPI.invoke("folders:imageBuffer", activeTrack.album.art) ]);
      const imageUrl = URL.createObjectURL(imageBlob);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: activeTrack.title,
        album: activeTrack.album.title,
        artist: artists,
        artwork: [
          {
            src: imageUrl,
            type: "image/png"
          },
        ]
      });
    });

    this.#audio.addEventListener("timeupdate", () => {
      const currentTime = this.#audio.currentTime * 1000;
      const lineElements = lyricsArea.children;
      let nextLineElement = lineElements.item(this.#activeLyricsLine + 1);
      const lineTime = Number.parseInt(nextLineElement?.getAttribute("timestamp"));
      if(lineTime < currentTime) {
        lineElements.item(this.#activeLyricsLine)?.classList.remove("active");
        this.#activeLyricsLine++;
        const activeLineElement = lineElements.item(this.#activeLyricsLine);
        if(activeLineElement) {
          activeLineElement.classList.add("active");
          if(!this.expanded) {
            activeLineElement.scrollIntoView({ behavior: "smooth" });
          }
        }
      }
      playedTime.textContent = readableSeconds(this.#audio.currentTime);
      this.#canvas.progress = this.#audio.currentTime / this.#audio.duration;
    });

    this.#audio.addEventListener("play", () => {
      this.activeTrack?.$self.send("playbackState", "playing");
    });

    this.#audio.addEventListener("pause", () => {
      this.activeTrack?.$self.send("playbackState", "paused");
    });

    this.#audio.addEventListener("ended", () => {
      this.activeTrack?.$self.send("playbackState", "ended");
      this.#playbackQueue.next();
      lyricsArea.children.item(this.#activeLyricsLine)?.classList.remove("active");
      this.#activeLyricsLine = 0;
    });

    this.#audio.addEventListener("seeked", () => {
      const currentTime = this.#audio.currentTime * 1000;
      const lineElements = lyricsArea.children;
      lineElements.item(this.#activeLyricsLine)?.classList.remove("active");
      this.#activeLyricsLine = 0;
      for(const lineIndex of new NumericRange(lineElements.length)) {
        const lineElement = lineElements.item(lineIndex);
        const lineTime = Number.parseInt(lineElement.getAttribute("timestamp"));
        if(lineTime <= currentTime) {
          this.#activeLyricsLine = lineIndex;
        }
      }
      lineElements.item(this.#activeLyricsLine)?.classList.add("active");
    });

    this.#audio.addEventListener("durationchange", () => {
      const { elements } = this;
      elements.duration.textContent = readableSeconds(this.#audio.duration);
      elements.playedTime.textContent = "00:00";
      lyricsArea.innerText = "";
    });

    this.#audio.addEventListener("toggle", function() {
      if(this.paused) {
        controls.playback.classList.toggle("active");
      }
    });

    controls.playback.addEventListener("click", async () => {
      this.togglePlayback();
    });

    controls.previous.addEventListener("click", () => this.#playbackQueue.previous());
    controls.next.addEventListener("click", () => this.#playbackQueue.next());

    controls.like.addEventListener("click", () => {
      if(this.activeTrack === null) {
        return;
      }
      this.activeTrack.$self.toggleField("liked");
    });

    this.elements.albumArt.addEventListener("click", async () => {
      this.toggleView();
    });

    controls.lyrics.addEventListener("click", async () => {
      const showLyrics = this.toggleAttribute("show-lyrics");
      controls.lyrics.classList.toggle("active", showLyrics);
    });

    this.#canvas.on("progressUpdate", event => {
      this.#audio.currentTime = this.#audio.duration * event.data.progress;
    });

    this.#playbackQueue.on("change", ({ data: { previous } }) => {
      const previousTrack = this.#queuedTracks[previous];
      if(previousTrack) {
        // remove previous listeners
        previousTrack.$self.off("update", this.#onTrackUpdate);
        previousTrack.$self.off("select", this.#onTrackSelect);
        previousTrack.$self.off("message", this.#onTrackMessage);
        previousTrack.$self.send("playbackState", "ended");
        Store.tracks.releaseItem(this, previousTrack.path);
      }
      this.#loadTrack(this.activeTrack);
    });

    navigator.mediaSession.setActionHandler("previoustrack", details => {
      this.#playbackQueue.previous();
    });

    navigator.mediaSession.setActionHandler("nexttrack", details => {
      this.#playbackQueue.next();
    });

  }

  get activeTrack() {
    return this.#queuedTracks[this.#playbackQueue.selected] ?? null;
  }

  get activeTrackIndex() {
    return this.#playbackQueue.selected;
  }

  get elements() {
    return {
      /** @type {HTMLSlotElement} */
      title: this.#shadowRoot.getElementById("titleSlot"),
      /** @type {HTMLSlotElement} */
      artist: this.#shadowRoot.getElementById("artistSlot"),
      /** @type {HTMLSlotElement} */
      playedTime: this.#shadowRoot.getElementById("playedTimeSlot"),
      /** @type {HTMLSlotElement} */
      duration: this.#shadowRoot.getElementById("durationSlot"),
      /** @type {HTMLImageElement} */
      albumArt: this.#shadowRoot.getElementById("albumArt"),
      /** @type {HTMLCanvasElement} */
      progressBar: this.#shadowRoot.getElementById("progress-bar"),
      /** @type {HTMLDivElement} */
      lyricsArea: this.#shadowRoot.getElementById("lyrics-area")
    };
  }

  get controls() {
    return fromEntries(this.controlNames.map(name => /** @type {const} */ ([ name, this.getControl(name) ])));
  }

  get src() {
    return this.#audio.src;
  }

  set src(src) {
    this.#audio.src = src;
  }

  get expanded() {
    return this.hasAttribute("expanded");
  }

  get activeLyricsLine() {
    return this.#activeLyricsLine;
  }

  /**
   * @param {AudioPlayer["controlNames"][number]} name
   * @returns {HTMLButtonElement}
   */
  getControl(name) {
    return this.#shadowRoot.getElementById(name + "Control");
  }

  /**
   * @param {import("../lists/lists").TrackHandlerItem[]} tracks
   * @param {number} [index]
  */
  loadTracks(tracks, index) {
    this.#queuedTracks = tracks;
    this.#playbackQueue.size = this.#queuedTracks.length;
    ConsoleLog.property({ index });
    this.loadTrackAt(index);
  }

  loadTrackAt(index = 0) {
    if(index !== undefined) {
      this.#playbackQueue.select(index);
    }
  }

  /** @param {import("../lists/lists").TrackHandlerItem} track */
  async #loadTrack(track) {

    Store.tracks.requestItem(this, this.activeTrack.path);

    // update properties
    this.src = this.activeTrack.path;

    // update active track info in UI
    const { title, artist, albumArt } = this.elements;
    const likeControl = this.getControl("like");
    title.textContent = this.activeTrack.title;
    artist.textContent = this.activeTrack.artists.map(artist => artist.name).join(", ");
    const { album } = this.activeTrack;
    albumArt.src = this.expanded ? album.art : album.thumbnails.x80;
    likeControl.classList.toggle("active", track.liked);

    // add new listener
    this.activeTrack.$self.on("update", this.#onTrackUpdate);
    this.activeTrack.$self.on("select", this.#onTrackSelect);
    this.activeTrack.$self.on("message", this.#onTrackMessage);

    await Promise.all([
      // update progress bar data
      this.#updateCanvasData(track),
      // play the track
      this.#audio.play()
    ]);
  }

  /** @param {import("../lists/lists").TrackHandlerItem} track */
  async #updateCanvasData(track) {
    const buffer = await electronAPI.invoke("folders:audioBuffer", track.path);
    const audioBuffer = await this.#audioContext.decodeAudioData(buffer.buffer);
    const progressBarParentWidth = this.elements.progressBar.parentElement.clientWidth;
    const filteredAudioBuffer0 = AudioPlayer.#filterAudioBuffer(audioBuffer, 0, Math.floor(progressBarParentWidth / 3));
    const filteredAudioBuffer1 = AudioPlayer.#filterAudioBuffer(audioBuffer, 1, Math.floor(progressBarParentWidth / 3));
    const normalisedData0 = AudioPlayer.normalizeAudioData(filteredAudioBuffer0);
    const normalisedData1 = AudioPlayer.normalizeAudioData(filteredAudioBuffer1);
    this.#canvas.setData([ normalisedData0, normalisedData1 ]);
  }

  /** @param {import("../lists/lists").TrackHandlerItem} track */
  async #loadLyrics(track) {
    const { lyricsArea } = this.elements;
    const loadingText = new Div({ className: "line", textContent: "loading lyrics..." });
    lyricsArea.append(loadingText);
    try {
      console.log({track})
      const { info, lyrics } = await electronAPI.invoke("folders:fetchLyrics", track.rowid);
      loadingText.remove();
      lyricsArea.append(...lyrics.split("\n").map(text => {
        if(!info.isSynced) {
          return new Div({ className: "line", textContent: text });
        }
        const [ time, lineText ] = text.split("]");
        const [ minutes, seconds ] = time.replace("[", "").split(":");
        const timestamp = Number.parseInt(minutes) * 60_000 + Number.parseInt(Number.parseFloat(seconds) * 1000)
        return new Div({
          className: "line",
          textContent: lineText.trim(),
          $attributes: { timestamp },
          $listeners: {
            click: () => {
              this.#audio.currentTime = timestamp / 1000;
            }
          }
        });
      }));
    } catch(ex) {
      loadingText.textContent = "Lyrics not available";
    }
  }

  /** @param {import("../../modules/extended-event.js").ExtendedEvent<import("../../modules/data-handler.js").DataHandlerItemEventMap<import("../lists/lists").TrackStructure, TrackChannelsMap>["update"]>} event */
  #onTrackUpdateDefinition(event) {
    if("liked" in event.data) {
      const likeControl = this.getControl("like");
      likeControl.classList.toggle("active", event.data.liked);
    }
  }

  /** @param {import("../../modules/extended-event.js").ExtendedEvent<import("../../modules/data-handler.js").DataHandlerItemEventMap<import("../lists/lists").TrackStructure, import("../lists/lists").TrackChannelsMap>["select"]>} event */
  #onTrackSelectDefinition(event) {
    switch(event.data.kind) {
      case "lyricsPaneVisible":
        const lyricsControl = this.getControl("lyrics");
        // lyricsControl.classList.toggle("active", true);
    }
  }

  /** @param {import("../../modules/extended-event.js").ExtendedEvent<import("../../modules/data-handler.js").DataHandlerItemEventMap<import("../lists/lists").TrackStructure, import("../lists/lists").TrackChannelsMap>["message"]>} event */
  #onTrackMessageDefinition(event) {
    switch(event.data.channel) {
      case "playbackState":
        this.setAttribute("playback-state", event.data.message);
    }
  }

  /**
   * @param {typeof AudioPlayer.observedAttributes[number]} name
   * @param {string} oldValue
   * @param {string} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    switch(name) {
      case "src":
        this.src = newValue;
    }
  }

  connectedCallback() {
    this.#resizeCanvas()
    this.#canvas.init();
  }

  disconnectedCallback() {
    this.#canvas.destroy();
  }

  #timeoutId;

  async #resizeCanvas(height) {
    clearTimeout(this.#timeoutId);
    await new Promise(resolve => this.#timeoutId = setTimeout(resolve, 300));
    const progressBarParent = this.elements.progressBar.parentElement;
    console.log(progressBarParent.clientWidth);
    this.#canvas.resize(progressBarParent.clientWidth, height);
  }

  /**
   * @param {EventTarget} eventTarget
   * @param {string} eventType
  */
  #forwardEvent(eventTarget, eventType) {
    eventTarget.addEventListener(eventType, () => {
      const event = new Event(eventType);
      this.dispatchEvent(event);
    });
  }

  #expandTimeout;

  expand() {
    this.toggleAttribute("expanded", true);
    this.#canvas.resize(0, 80);
    const { activeTrack } = this;
    if(activeTrack) {
      this.elements.albumArt.src = this.activeTrack.album?.art ?? "assets/images/default-art.png";
      this.#updateCanvasData(activeTrack);
      clearTimeout(this.#expandTimeout);
      this.#expandTimeout = setTimeout(() => this.#resizeCanvas(), 100);
    }
  }

  collapse() {
    this.toggleAttribute("expanded", false);
    this.#canvas.resize(0, 40);
    const { activeTrack } = this;
    if(activeTrack) {
      this.elements.albumArt.src = this.activeTrack.album?.thumbnails.x80 ?? "assets/images/default-art.png";
      this.#updateCanvasData(activeTrack);
      clearTimeout(this.#expandTimeout);
      this.#expandTimeout = setTimeout(() => this.#resizeCanvas(), 100);
    }
  }

  toggleView(force = !this.expanded) {
    if(force) {
      return void this.expand();
    }
    this.collapse();
  }

  async play() {
    await this.#audio.play();
  }

  pause() {
    this.#audio.pause();
  }

  async togglePlayback() {
    console.log(this.#audio.paused);
    if(this.#audio.paused) {
      await this.#audio.play();
      return true;
    }
    this.#audio.pause();
    return false;
  }

  /** @param {AudioBuffer} audioBuffer */
  static #filterAudioBuffer(audioBuffer, channel = 0, samples = 70) {
    const channelIndex = Math.min(audioBuffer.numberOfChannels - 1, channel);
    const rawData = audioBuffer.getChannelData(channelIndex);
    const blockSize = Math.floor(rawData.length / samples);
    const filteredData = [];
    for(let i = 0; i < samples; i++) {
      let blockStart = blockSize * i;
      let sum = 0;
      for(let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j]);
      }
      filteredData.push(sum / blockSize);
    }
    return filteredData;
  }

  /** @param {number[]} audioData */
  static normalizeAudioData(audioData) {
    const scaleFactor = 1 / Math.max(...audioData);
    return audioData.map(data => data * scaleFactor);
  }

  /** @param {HTMLAudioElement} audio */
  static getVisualData(audio) {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaElementSource(audio);

    source.connect(analyser);
    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    return {dataArray, frequencyData};
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