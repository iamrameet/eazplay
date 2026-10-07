import { app } from "electron";
import NodePath from "node:path";
import Logger from "../library/logger.js";
import Manager from "../library/lil-db.js";
import { Album, Artist, Directory, Track } from "../_structures/index.js";

const logger = new Logger("MANAGER");

const tracks = new Manager(NodePath.join(app.getPath("userData"), "manager-data/tracks.json"), Track, { logger });
const directories = new Manager(NodePath.join(app.getPath("userData"), "manager-data/directories.json"), Directory, { logger });
const artists = new Manager(NodePath.join(app.getPath("userData"), "manager-data/artists.json"), Artist, { logger });
const albums = new Manager(NodePath.join(app.getPath("userData"), "manager-data/albums.json"), Album, { logger });
// const datamanager = new Manager(NodePath.join(app.getPath("appData"), "tracks.json"), Track);

await tracks.load();
await directories.load();
await artists.load();
await albums.load();

// await tracks.save();
// await albums.save();
// await artists.save();

export const DataManager = { tracks, directories, artists, albums };