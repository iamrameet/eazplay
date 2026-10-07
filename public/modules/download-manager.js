import DownloadItem from "../templates/lists/download-item.js";

export default class DownloadManager {

  /** @type {Map<string, DownloadItem>} */
  static #map = new Map;

  /** @param {string} id */
  static has(id) {
    return this.#map.has(id);
  }

  /**
   * @param {string} id
   * @param {import("../templates/lists/download-item.js").DownloadItemProperties} properties
   * @returns item added
   */
  static addOrUpdate(id, properties) {
    if(!this.#map.has(id)) {
      return this.add(id, properties);
    }
    this.update(id, properties);
    return null;
  }

  /**
   * @param {string} id
   * @param {import("../templates/lists/download-item.js").DownloadItemProperties} properties
   * @returns item added
   */
  static add(id, properties) {
    const item = new DownloadItem(properties.title, properties.totalSize, properties.downloadedSize, properties.speed);
    this.#map.set(id, item);
    return item;
  }

  /**
   * @param {string} id
   * @param {import("../templates/lists/download-item.js").DownloadItemProperties} properties
   */
  static update(id, properties) {
    const element = this.#map.get(id);
    element.downloadedSize = properties.downloadedSize;
    element.totalSize = properties.totalSize;
    element.speed = properties.speed;
  }

};