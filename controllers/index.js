import dataController from "./data.js";
import downloadsController from "./downloader.js";
import { foldersController } from "./files.js";
import requestController from "./request.js";
import windowController from "./window.js";

const ipcControllers = {
  window: windowController,
  folders: foldersController,
  downloader: downloadsController,
  data: dataController,
  request: requestController
};

export default ipcControllers;