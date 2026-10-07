
import { app } from "electron";
import Manager, { Field, Manageable, Structure, DBTypes } from "./library/lil-db.2.js";
import Type, { Types } from "./library/types.js";
// import { Track } from "./structures/index.js";
import NodePath from "node:path";

const StringArray = Types.Array.construct(DBTypes.ID, 10);
const StringSet = Types.Set.construct(DBTypes.ID, 10);

const TrackStructure = new Structure({
  path: new Field({ type: Types.String, required: true, unique: true, size: 64 }),
  title: new Field({ type: Types.String, size: 20 }),
  artists: new Field({ type: StringSet }),
  album: new Field({ type: DBTypes.ID }),
  lyrics: new Field({ type: StringArray }),
  liked: new Field({ type: Types.Boolean }),
  explicit: new Field({ type: Types.Boolean })
});

class Track extends Manageable.new(TrackStructure) {
  /** @param {ConstructorParameters<ReturnType<typeof Manageable.new<import("./library/lil-db.2.js").InferReadonly<typeof TrackStructure.fields>>>} args */
  constructor(...args) {
    args[0].id = args[0].path;
    super(args[0]);
  }
};

/** @type {Manager<typeof Track>} */
const tracksDataManager = new Manager(NodePath.join(app.getPath("userData"), "manager-database"), Track);
await tracksDataManager.load();

// await tracksDataManager.add(new Track({
//   path: Track.createId(),
//   title: "track tile 2",
//   album: "albumI 2e d",
//   artists: [ "0123456789abcdef", "0123456789abcdef", "0123456789abcdef", "0123456789abcdef", "0123456789abcdef", "0123456789abcdef", "0123456789abcdef", "0123456789abcdef", "0123456789abcdef", "0123456789abcdef" ]
// }))

export const data = await tracksDataManager.findAll(function(track) {
  return track.get("artists").has("0123456789abcdef");
});
console.log(data.map(data => data.toObject()));
