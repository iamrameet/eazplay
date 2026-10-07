import { Conversions } from "../../modules/util.js";

const { downloadItemTemplate } = await eazuse(import.meta.resolve("./download-item.html"));

/** @typedef {{ title: string; totalSize: number; downloadedSize: number; speed: string }} DownloadItemProperties */

export default class DownloadItem extends HTMLLIElement {

  /** @type {number} */
  #totalSize;
  /** @type {number} */
  #downloadedSize;
  #elements;

  /**
   * @param {string} title
   * @param {number} totalSize
   * @param {number} downloadSize
   * @param {string} speed
   */
  constructor(title, totalSize, downloadSize = 0, speed = 0) {
    super();
    this.classList.add("download-item");
    const fragment = downloadItemTemplate.content.cloneNode(true);
    this.#elements = {
      /** @type {HTMLOutputElement} */
      title: fragment.getElementById("title"),
      /** @type {HTMLOutputElement} */
      downloaded: fragment.getElementById("downloaded"),
      /** @type {HTMLOutputElement} */
      size: fragment.getElementById("size"),
      /** @type {HTMLOutputElement} */
      speed: fragment.getElementById("speed"),
      /** @type {HTMLProgressElement} */
      progress: fragment.getElementById("progress")
    };
    this.appendChild(fragment);
    this.#elements.title.value = title ?? this.getAttribute("title") ?? "{{Title}}";
    this.totalSize = totalSize ?? 0;
    this.downloadedSize = downloadSize;
    this.speed = speed;
  }

  get totalSize() {
    return this.#totalSize;
  }
  get downloadedSize() {
    return this.#downloadedSize;
  }
  get speed() {
    return this.#elements.speed.value;
  }

  set totalSize(value) {
    this.#totalSize = value;
    this.#elements.size.value = Conversions.Data.bytesToMB(value, { units: true });
    this.#updateProgressBarState();
  }
  set downloadedSize(value) {
    this.#downloadedSize = value;
    this.#elements.downloaded.value = Conversions.Data.bytesToMB(value, { units: true });
    this.#updateProgressBarState();
  }
  set speed(value) {
    this.#elements.speed.value = Conversions.Data.BpmsToMBps(value, { units: true });
  }

  #updateProgressBarState() {
    const percent = this.#downloadedSize / this.#totalSize;
    if(Number.isFinite(percent)) {
      this.#elements.progress.value = percent;
      return;
    }
    this.#elements.progress.removeAttribute("value");
  }

};