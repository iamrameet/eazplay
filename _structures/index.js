import { fromEntries } from "../common/util.js";
import { Field, Manageable, Structure } from "../library/lil-db.js";
import Type, { Types } from "../library/types.js";
import MediaFileSystem from "../tools/media-file-system.js";

class String16 extends Types.String {
  static [Type.SIZE] = 16;
};

class String32 extends Types.String {
  static [Type.SIZE] = 32;
};

const CodecFormat = Types.Object.construct({
  container: String16,
  encoder: String16
});

const ExternalRefs = Types.Object.construct({
  spotify: String32,
  deezer: String32,
  youtube: String32
});

const Lyrics = Types.Object.construct({
  filename: String16,
  source: String16,
  sourceRef: String16,
  instrumental: Types.Boolean,
  language: String16,
  isSynced: Types.Boolean
});

const StringArray = Types.Array.construct(Types.String, 200);
const ThumbnailsType = Types.Object.construct(fromEntries(MediaFileSystem.thumbnailSizes.map(size => /** @type {const} */ ([`x${ size }`, Types.String]))));

const TrackStructure = new Structure({
  path: new Field({ type: Types.String, required: true, unique: true }),
  title: new Field({ type: Types.String, size: 50 }),
  artists: new Field({ type: StringArray }),
  album: new Field({ type: Types.String, size: 50 }),
  liked: new Field({ type: Types.Boolean }),
  explicit: new Field({ type: Types.Boolean }),
  duration: new Field({ type: Types.Number, size: 8 }),
  bitrate: new Field({ type: Types.Number, size: 8 }),
  sampleRate: new Field({ type: Types.Number, size: 8 }),
  codec: new Field({ type: CodecFormat }),
  channels: new Field({ type: Types.Number, size: 2 }),
  lossless: new Field({ type: Types.Boolean, defaultValue: false }),
  externalRefs: new Field({ type: ExternalRefs }),
  lyrics: new Field({ type: Lyrics })
});

const ArtistStructure = new Structure({
  name: new Field({ type: Types.String, required: true }),
  tracks: new Field({ type: StringArray }),
  albums: new Field({ type: StringArray }),
  image: new Field({ type: Types.String, *defaultValue() { yield "assets/images/default-artist.png"; } })
});

const AlbumStructure = new Structure({
  title: new Field({ type: Types.String }),
  tracks: new Field({ type: StringArray }),
  artist: new Field({ type: Types.String }),
  artists: new Field({ type: StringArray }),
  art: new Field({ type: Types.String, *defaultValue() { yield "assets/images/default-art.png"; } }),
  thumbnails: new Field({
    type: ThumbnailsType,
    *defaultValue() {
      yield fromEntries(MediaFileSystem.thumbnailSizes.map(size => [`x${ size }`, "assets/images/default-art.png"]));
    }
  })
});

export class Track extends Manageable.new(TrackStructure) {
  /** @param {ConstructorParameters<ReturnType<typeof Manageable.new<import("../library/lil-db.js").InferReadonly<typeof TrackStructure.fields>>>} args */
  constructor(...args) {
    args[0].id = args[0].path;
    super(args[0]);
  }
};

export class Artist extends Manageable.new(ArtistStructure) {};

export class Album extends Manageable.new(AlbumStructure) {};

export class Directory extends Manageable.new({
  path: new Field({ type: Types.String, required: true, unique: true })
}) {
  /** @param {ConstructorParameters<ReturnType<typeof Manageable.new<{ path: Field<typeof Types.String>; }>>} args */
  constructor(...args) {
    args[0].id = args[0].path;
    super(args[0]);
  }
};

export const File = Manageable.new({
  path: new Field({ type: Types.String, required: true })
});

export const CustomTypes = { StringArray };