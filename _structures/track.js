import { DBTypes, Field, Manageable, Structure } from "../library/lil-db.2";
import { Types } from "../library/types.js";

const StringArray = Types.Array.construct(DBTypes.ID, 10);
const StringSet = Types.Set.construct(DBTypes.ID, 10);

const TrackStructure = new Structure({
  path: new Field({ type: Types.String, required: true, unique: true, size: 64 }),
  title: new Field({ type: Types.String, size: 20 }),
  artists: new Field({ type: StringSet }),
  album: new Field({ type: DBTypes.ID }),
  lyrics: new Field({ type: DBTypes.ID }),
  liked: new Field({ type: Types.Boolean }),
  explicit: new Field({ type: Types.Boolean })
});

export default class Track extends Manageable.new(TrackStructure) {
  /** @param {ConstructorParameters<ReturnType<typeof Manageable.new<import("./library/lil-db.2.js").InferReadonly<typeof TrackStructure.fields>>>} args */
  constructor(...args) {
    args[0].id = args[0].path;
    super(args[0]);
  }
};