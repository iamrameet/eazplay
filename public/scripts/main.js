/// <reference path="../modules/eazuse.js"/>
/// <reference path="../scripts/promise.js"/>
/// <reference path="../scripts/global.d.ts"/>

import { CardsArea, CardElement } from "../templates/cards/cards.js";
import { DataList, ListItem } from "../templates/lists/lists.js";
import { AudioPlayer } from "../templates/player/player.js";
import { PanesManager, Pane, PaneNavigator } from "../templates/pane/pane.js";
import { elementsById, using, VariableManager } from "../modules/util.js";
import Menu from "../templates/menu/menu.js";
import { SegmentedInput, UICheckbox, InputBox, UIRadio, UISelect } from "../templates/input/input.js";
import ElementsBuilder from "../modules/elements-builder.js";
import TitleBar from "../templates/app/title-bar.js";
import AlertPanel from "../templates/dialog/alert-panel.js";
import DataHandler from "../modules/data-handler.js";
import SVGIcon from "../templates/icon/icon.js";
import DownloadItem from "../templates/lists/download-item.js";
import DownloadManager from "../modules/download-manager.js";
import DataStore from "../modules/data-store.js";
import { sleep } from "./promise.js";

globalThis.Menu = Menu;

SVGIcon.setDefaultViewBox({ width: 256 });

customElements.define("svg-icon", SVGIcon);
customElements.define("title-bar", TitleBar);
customElements.define("custom-menu", Menu, { extends: "menu" });
customElements.define("panes-manager", PanesManager);
customElements.define("pane-option", Pane);
customElements.define("pane-navigator", PaneNavigator, { extends: "button" });
customElements.define("cards-area", CardsArea);
customElements.define("card-element", CardElement);
customElements.define("data-list", DataList);
customElements.define("list-item", ListItem);
customElements.define("download-item", DownloadItem, { extends: "li" });
customElements.define("audio-player", AudioPlayer);
customElements.define("ui-checkbox", UICheckbox);
customElements.define("ui-radio", UIRadio);
customElements.define("input-box", InputBox);
customElements.define("ui-select", UISelect);
customElements.define("segmented-input", SegmentedInput);
customElements.define("alert-panel", AlertPanel);

const {
  li: LI,
  div: Div,
  img: Img,
  button: Button
} = ElementsBuilder.multiple("li", "div", "img", "button");

const Use = ElementsBuilder.singleNS("http://www.w3.org/2000/svg", "use");

const SVG = ElementsBuilder.extendedNS("http://www.w3.org/2000/svg", "svg", function(viewBox, href) {
  return [{
    $attributes: { viewBox },
    appendChild: new Use({
      $attributes: { href }
    })
  }];
});

globalThis.ManageableStructures = await electronAPI.invoke("folders:structures");

/** @type {{ [K in keyof typeof ManageableStructures]: DataHandler<typeof ManageableStructures[K] & { index: { _type: number; primitiveType: "number" } }, K extends "tracks" ? import("../templates/lists/lists.js").TrackChannelsMap : K extends "artists" ? { show: "tracks" } : {}> }} */
const Data = {};

globalThis.Data = Data;

for(const key in ManageableStructures) {
  Data[key] = new DataHandler(ManageableStructures[key]);
}

globalThis.Store = {
  tracks: new DataStore(Data.tracks, "path", {
    update(setter) {
      electronAPI.on("data:tracks:update", setter);
    }
  }),
  artists: new DataStore(Data.artists, "rowid"),
  albums: new DataStore(Data.albums, "rowid")
};

globalThis.DB = await electronAPI.invoke("folders:database");

globalThis.TrackQueues = new class {

  /** @type {Map<string, import("../templates/lists/lists.js").TrackHandlerItem[]>} */
  #queues = new Map;
  /** @type {string | undefined} */
  #activeId;

  get active() {
    return this.#queues.get(this.#activeId) ?? null;
  }

  /**
   * @param {string} id
   * @param {import("../templates/lists/lists.js").TrackHandlerItem[]} tracks
   */
  addQueue(id, tracks = []) {
    this.#queues.set(id, tracks);
  }

  /** @param {string} id */
  getQueue(id) {
    return this.#queues.get(id);
  }

  /** @param {string} id */
  setActive(id) {
    if(id === this.#activeId) {
      return false;
    }
    console.log("setActive: ", id);
    if(this.#queues.has(id)) {
      this.#activeId = id
      return true;
    }
    return false;
  }

};

async function main() {
  /** @type {{ "cardsTemplate": HTMLTemplateElement; "cardTemplate": HTMLTemplateElement; "dataList": HTMLTemplateElement; "listItem": HTMLTemplateElement; "playerTemplate": HTMLTemplateElement; "panesTemplate": HTMLTemplateElement; "paneTemplate": HTMLTemplateElement; "iconInputTemplate": HTMLTemplateElement; "checkboxTemplate": HTMLTemplateElement; "radioTemplate": HTMLTemplateElement; "inputBoxTemplate": HTMLTemplateElement; "segmentedInputTemplate": HTMLTemplateElement; "selectTemplate": HTMLTemplateElement; "titleBarTemplate": HTMLTemplateElement; "alertPanelTemplate": HTMLTemplateElement; "downloadItemTemplate": HTMLTemplateElement; "title-bar": TitleBar; "left-bar": HTMLElement; "logo": HTMLLIElement; "right-section": HTMLElement; "mainSection": PanesManager<"dashboard" | "songs" | "albums" | "artists" | "liked" | "folders" | "downloads" | "themes" | "settings" | "album" | "artist" | "lyrics">; "songsSearchForm": HTMLFormElement; "songsSearchInput": InputBox; "songsList": DataList<"data:getTracks">; "albumsList": CardsArea; "artistsList": CardsArea; "likedTracksSearchForm": HTMLFormElement; "likedTracksSearchInput": InputBox; "likedTracks": DataList<"data:getLikedTracks">; "addFolderInput": InputBox; "foldersList": HTMLUListElement; "remember-me": UICheckbox; "list": UISelect; "activeDownloadsList": HTMLUListElement; "albumTracksSearchForm": HTMLFormElement; "albumTracksSearchInput": InputBox; "albumTracksList": DataList<"data:getTracksByAlbum">; "artistTracksSearchForm": HTMLFormElement; "artistTracksSearchInput": InputBox; "artistReleases": DataList<"null">; "artistTracksList": DataList<"data:getTracksByArtist">; "lyricsContainer": HTMLDivElement; "player": AudioPlayer; "appMenu": Menu; "folders": HTMLLIElement; "downloads": HTMLLIElement; "themes": HTMLLIElement; "exit": HTMLLIElement; "alertPanel": AlertPanel; "right-bar": HTMLElement }} */
  const $E = elementsById(true);
  /** @type {VariableManager<"app.title" | "albumPane.title" | "artistPane.name" | "lyricsPane.title" | "app.version">} */
  const $V = new VariableManager(document, true);

  globalThis.$E = $E;
  globalThis.$V = $V;

  $V.setMany(await electronAPI.invoke("app:config"));

  // init data list search
  {

    const trackLists = [
      /** @type {const} */ ([$E.songsList, $E.songsSearchForm, $E.songsSearchInput]),
      /** @type {const} */ ([$E.artistTracksList, $E.artistTracksSearchForm, $E.artistTracksSearchInput]),
      /** @type {const} */ ([$E.albumTracksList, $E.albumTracksSearchForm, $E.albumTracksSearchInput]),
      /** @type {const} */ ([$E.likedTracks, $E.likedTracksSearchForm, $E.likedTracksSearchInput])
    ];

    for(const [dataList, form, searchInputBox] of trackLists) {

      form.addEventListener("submit", function(event) {
        const formData = new FormData(this);
        event.preventDefault();
        dataList.extraData.query = formData.get("query");
        dataList.requestItems();
      });

      searchInputBox.addEventListener("blur", function() {
        if(this.value.length === 0) {
          this.disabled = true;
        }
      });

      searchInputBox.rightIconElement.addEventListener("click", function(event) {
        if(searchInputBox.disabled) {
          searchInputBox.disabled = false;
          searchInputBox.focus();
          return void event.preventDefault();
        }
      });

    }

  }

  $E.mainSection.addEventListener("panechange", function(event) {
    $E.player.collapse();
    for(const navigator of this.paneNavigators(event.previousPane?.name)) {
      navigator.parentElement.classList.remove("active");
    }
    for(const navigator of this.paneNavigators(event.currentPane.name)) {
      navigator.parentElement.classList.add("active");
    }
    switch(this.selectedPaneName) {
      case "songs":
        $E.songsList.requestItems();
      break;
      case "liked":
        $E.likedTracks.requestItems();
      break;
    }
  });

  $E.songsList.store = Store.tracks;
  $E.likedTracks.store = Store.tracks;
  $E.artistTracksList.store = Store.tracks;
  $E.albumTracksList.store = Store.tracks;
  setTimeout(() => {
    $E.mainSection.selectPane("songs");
  }, 100);

  $E.logo.addEventListener("click", $E.appMenu.togglePopover.bind($E.appMenu));
  $E.appMenu.getItems().exit.getElementsByTagName("button")[0].addEventListener("click", function() {
    electronAPI.invoke("window:quit");
  });

  $E.addFolderInput.addEventListener("change", async function(event) {
    for(const folderPath of this.filepaths) {
      const tracks = await scanFolders($E.foldersList, folderPath);
      Data.tracks.add(...tracks);
    }
  });

  addEventListener("keyup", function(event) {
    switch(event.code) {
      case "AltLeft":
        $E.appMenu.togglePopover();
      break;
      case "F5":
      case "Escape":
        location.reload();
    }
  });

  TrackQueues.addQueue("likedTracks");
  TrackQueues.addQueue("songsList");

  /** @param {ConstructorParameters<typeof ListItem>[0]} track  */
  async function addTrackToLikedList(track) {
    TrackQueues.getQueue("likedTracks").push(track);
    const likedTrackItem = new ListItem(track);
    $E.likedTracks.appendChild(likedTrackItem);
    while(true) {
      const updateEvent = await Data.tracks.until("update");
      if(updateEvent.data.item.id === track.id && !track.liked) {
        likedTrackItem.remove();
        break;
      }
    }
  }

  Data.tracks.on("add", async function({ data: track }) {
    return;
    const listItem = new ListItem(track);
    listItem.id = "all-tracks-" + track.id;
    // $E.songsList.appendChild(listItem);
    if(track.liked) {
      addTrackToLikedList(track);
    }
  });

  Data.tracks.on("update", async function({ data }) {
    const track = await electronAPI.invoke("folders:updateTrack", data.item.path, data.fields);
    if("liked" in data.fields) {
      if(!track.liked) {
        $E.likedTracks.size--;
        const likedChildren = Array.from($E.likedTracks.children);
        let shiftIndex;
        for(const [index, element] of likedChildren.entries()) {
          shiftIndex = index;
          if(element instanceof ListItem && element.track.path === track.path) {
            element.remove();
            break;
          }
        }
        for(let index = shiftIndex + 1; index < likedChildren.length; index++) {
          likedChildren[index].style.top = `calc(5rem * ${ $E.likedTracks.offset + index - 1 })`;
        }
      } else {
        $E.likedTracks.size++;
      }
      // addTrackToLikedList(data.item);
    }
  });

  Data.tracks.on("message", async function({ data }) {
    console.log("data:", data);
    switch(data.channel) {
      case "activeQueue":
        const changed = TrackQueues.setActive(data.message.queueId);
        const activeQueue = TrackQueues.active ?? [];
        const index = activeQueue.findIndex(track => track === data.item);
        if(changed) {
          $E.player.loadTracks(activeQueue, index);
          return;
          // data.item.$self.select("playback");
        }
        console.log($E.player.activeTrackIndex, index)
        if($E.player.activeTrackIndex === index) {
          $E.player.togglePlayback();
          return;
        }
        $E.player.loadTrackAt(index);
        // data.item.$self.toggle("playback");
      break;
      case "togglePlayback":
        $E.player.togglePlayback();

      case "download": {
        function downloadhandler(info) {
          const addedItem = DownloadManager.addOrUpdate(info.trackId, {
            title: info.filepath,
            totalSize: info.totalSize,
            downloadedSize: info.downloadedSize,
            speed: info.speed
          });
          if(addedItem) {
            $E.mainSection.selectPane("downloads");
            $E.activeDownloadsList.appendChild(addedItem);
          }
        }
        try {
          data.item.$self.send("downloadState", "progress");
          electronAPI.on("downloader:spotify:progress", downloadhandler);
          if(data.item.externalRefs.spotify) {
            await electronAPI.invoke("downloader:spotify", data.item.externalRefs.spotify, data.item);
          } else {
            await electronAPI.invoke("downloader:spotifyByISRC", data.item.externalRefs.isrc);
          }
          electronAPI.off("downloader:spotify:progress", downloadhandler);
          data.item.$self.send("downloadState", "done");
          $E.alertPanel.success("Track downloaded");
        } catch(ex) {
          $E.alertPanel.error(ex?.message ?? ex);
          data.item.$self.send("downloadState", "idle");
        }
      }
      break;

      case "showArtist": {
        const artist = data.item.artists[data.message.artistIndex];
        $V.set("artistPane.name", artist.name);
        $E.mainSection.selectPane("artist");
        $E.artistTracksList.extraData.artistId = artist.id;
        $E.artistTracksList.size = await electronAPI.invoke("data:getTracksCountByArtist", artist.id);
        $E.artistTracksList.requestItems();
        const musicBrainzArtist = await electronAPI.invoke("request:artistByName", artist.name);
        const artistTracks = await electronAPI.invoke("request:artistTracksByMusicBrainzId", musicBrainzArtist.id);
        $E.artistReleases.size = artistTracks.length;
        $E.artistReleases.clearItems();
        for(const [index, track] of artistTracks.entries()) {
          const trackItem = Data.tracks.parseItem({
            album: { art: "", id: null, title: null, thumbnails: { x80: "assets/images/default-art.png" } },
            artists: [ artist ],
            bitrate: 0,
            channels: 2,
            codec: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            duration: +track.duration,
            explicit: false,
            externalRefs: {
              isrc: track.isrc
            },
            liked: true,
            lossless: false,
            lyrics: null,
            path: "",
            rowid: null,
            sampleRate: 0,
            title: track.title
          });
          const listItem = new ListItem(trackItem);
          listItem.style.top = `calc(5rem * ${ index })`;
          $E.artistReleases.appendChild(listItem);
        }
      }
      break;

      case "showAlbum": {
        const { album } = data.item;
        $V.set("albumPane.title", album.title);
        $E.mainSection.selectPane("album");
        TrackQueues.addQueue("albumTracksList");
        $E.albumTracksList.extraData.albumId = album.id;
        $E.albumTracksList.size = await electronAPI.invoke("data:getTracksCountByAlbum", album.id);
        $E.albumTracksList.requestItems();
      }

    }
  });

  Data.tracks.on("select", async function(event) {
    switch(event.data.kind) {
      case "album":
        document.getElementById("albums-pane-card-" + event.data.current.album).click();
      break;
      case "showLyrics":
        const track = event.data.current;
        console.log({track})
        const { info, lyrics } = await electronAPI.invoke("folders:fetchLyrics", track.rowid);
        $V.set("lyricsPane.title", track.title);
        $E.mainSection.selectPane("lyrics");
        $E.lyricsContainer.innerText = "";
        $E.lyricsContainer.append(...lyrics.split("\n").map(text => {
          if(!info.isSynced) {
            return new Div({ className: "line", textContent: text });
          }
          const [ time, lineText ] = text.split("]");
          const [ minutes, seconds ] = time.replace("[", "").split(":");
          const timestamp = Number.parseInt(minutes) * 60_000 + Number.parseInt(Number.parseFloat(seconds) * 1000)
          return new Div({
            className: "line ts-" + Math.ceil(timestamp / 2000) * 2000,
            textContent: lineText.trim(),
            $attributes: { timestamp }
          });
        }));
        track.$self.select("lyricsPaneVisible");
    }
  });

  // Artists

  Data.artists.on("add", async function({ data: artist }) {
    const card = new CardElement({ size: "large", wide: "x" });
    card.id = "artists-pane-card-" + artist.id;
    card.append(
      new Div({
        className: "image",
        appendChild: new Img({ src: artist.image, loading: "lazy" })
      }),
      new Div({
        className: "name",
        textContent: artist.name
      })
    );
    card.addEventListener("click", function() {
      artist.$self.send("show");
    });
    $E.artistsList.appendChild(card);
  });

  Data.artists.on("select", function({ data: { kind, current: artist } }) {
    switch(kind) {
      case "pane":
        $E.mainSection.selectPane("artist");
        $V.set("artistPane.name", artist.name);
        return;
        $E.artistTracksList.innerHTML = "";
        TrackQueues.addQueue("artistTracksList");
        for(const trackId of artist.tracks) {
          /** @type {ListItem} */
          const item = document.getElementById("all-tracks-" + trackId);
          TrackQueues.getQueue("artistTracksList").push(item.track);
          $E.artistTracksList.append(item.cloneNode());
        }
    }
  });

  Data.artists.on("message", async function(event) {
    const artist = event.data.item;
    switch(event.data.channel) {
      case "show": {
        $E.mainSection.selectPane("artist");
        $V.set("artistPane.name", artist.name);
        $E.artistTracksList.extraData.artistId = artist.rowid;
        $E.artistTracksList.size = await electronAPI.invoke("data:getTracksCountByArtist", artist.rowid);
        $E.artistTracksList.requestItems();
      }
    }
  });

  // Albums

  Data.albums.on("add", async function({ data: album }) {
    if(album.thumbnails === undefined) {
      console.log(album)
    }
    const card = new CardElement({ size: "x-large", wide: "x" });
    card.id = "albums-pane-card-" + album.id;
    card.append(
      new Div({
        className: "image",
        appendChild: new Img({ src: album.art, loading: "lazy" })
      }),
      new Div({
        className: "info",
        append: [
          new Div({
            className: "title",
            textContent: album.title ?? "Unknown"
          }),
          new Div({
            className: "artist",
            textContent: DB.artists[album.artist]?.name ?? "Unknown"
          }),
          new Div({
            className: "tracks",
            textContent: album.tracks.length + " track" + (album.tracks.length > 1 ? "s" : "")
          }),
          new Div({
            className: "buttons",
            append: [
              new Button({
                className: "playback icon",
                appendChild: new SVG("0 0 256 256", "assets/icons/filled.svg#play")
              }),
              new Button({
                className: "icon",
                appendChild: new SVG("0 0 256 256", "assets/icons/filled.svg#liked")
              })
            ]
          })
        ]
      })
    );
    card.addEventListener("click", function() {
      album.$self.select("pane");
    });
    $E.albumsList.appendChild(card);
  });

  Data.albums.on("select", async function({ data: { kind, current: album } }) {
    console.log(album, kind);
    switch(kind) {
      case "pane":
        $E.mainSection.selectPane("album");
        $V.set("albumPane.title", album.title);
        TrackQueues.addQueue("albumTracksList");
        $E.albumTracksList.extraData.albumId = album.rowid;
        $E.albumTracksList.size = await electronAPI.invoke("data:getTracksCountByAlbum", album.rowid);
        $E.albumTracksList.requestItems();
    }
  });

  Data.albums.on("message", async function(event) {
    const album = event.data.item;
    switch(event.data.channel) {
      case "show": {
        $E.mainSection.selectPane("album");
        $V.set("albumPane.title", album.title);
        $E.albumTracksList.extraData.albumId = album.rowid;
        $E.albumTracksList.size = await electronAPI.invoke("data:getTracksCountByAlbum", album.rowid);
        $E.albumTracksList.requestItems();
      }
    }
  });

  const scanPromises = [];
  for(const directory of Object.values(DB.directories)) {
    scanPromises.push(scanFolders($E.foldersList, directory.path).then(tracks => Data.tracks.add(...tracks)));
  }

  void function() {
    Data.albums.add(...Object.values(DB.albums));
    // Data.tracks.add(...Object.values(DB.tracks));
    Data.artists.add(...Object.values(DB.artists));
  }()
  const recordsCount = await electronAPI.invoke("data:getCount");
  $E.songsList.size = recordsCount.tracks;
  $E.likedTracks.size = recordsCount.likedTracks;
  // $E.alertPanel.success(`${ recordsCount.tracks } tracks loaded`, { type: AlertPanel.Popup.SUCCESS });

  await Promise.all(scanPromises);
  // $E.alertPanel.popup(`${ Object.keys(DB.directories).length } directores added`);
}

if(document.readyState !== "complete") {
  await window.until("load");
}
main.call(window);

/** @param {HTMLUListElement} foldersList */
async function scanFolders(foldersList, directoryPath) {
  const progressText = new Text("0%");
  foldersList.appendChild(new LI({
    append: [ new Text(directoryPath), progressText ]
  }));

  /** @param {{ path: string; type: string; current: number; total: number }} progress */
  function scanProgressHandler(progress, scanned, total) {
    if(directoryPath !== progress.path || total === 0) {
      return;
    }
    progressText.textContent = ` (${ progress.current }/${ progress.total } ${ progress.type }) ${ (scanned / total * 100).toFixed(0) }%`;
  }
  electronAPI.on("folders:scan:progress", scanProgressHandler);
  const tracks = await electronAPI.invoke("folders:scan", directoryPath);
  electronAPI.off("folders:scan:progress", scanProgressHandler);
  progressText.remove();
  return tracks;
}