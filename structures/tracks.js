import { Column, Columns } from "../library/db.js";

const TrackStructure = Object.freeze({
  path: new Column("TEXT", 32, { required: true, unique: true }),
  title: new Column("TEXT", 50),
  album: new Column("INTEGER", 11),
  liked: new Column("BOOLEAN", 1),
  explicit: new Column("BOOLEAN", 1),
  duration: new Column("INTEGER", 8),
  bitrate: new Column("INTEGER", 8),
  sampleRate: new Column("INTEGER", 8),
  /** @type {InstanceType<typeof Columns.JSON<{ container?: string; encoder?: string; }, false, false>>} */
  codec: new Columns.JSON(),
  channels: new Column("INTEGER", 8),
  lossless: new Column("BOOLEAN", 1, { defaultValue: false }),
  /** @type {InstanceType<typeof Columns.JSON<{ spotify: string; youtube: string; }, false, false>>} */
  externalRefs: new Columns.JSON(),
  /** @type {InstanceType<typeof Columns.JSON<{ filename: string; source: string; sourceRef: string; instrumental: boolean; language: string; isSynced: boolean }, false, false>>} */
  lyrics: new Columns.JSON()
});

export default TrackStructure;