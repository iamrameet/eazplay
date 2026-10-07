import { fromEntries } from "../common/util.js";
import { Column, Columns } from "../library/db.js";
import MediaFileSystem from "../tools/media-file-system.js";

const AlbumStructure = Object.freeze({
  rowid: new Column("INTEGER", Infinity, { autoIncrement: true }),
  title: new Column("TEXT", 50),
  artist: new Column("INTEGER"),
  art: new Column("TEXT", 32, { defaultValue: "assets/images/default-art.png" }),
  releaseDate: new Column("DATE"),
  thumbnails: new Columns.JSON({
    defaultValue: fromEntries(MediaFileSystem.thumbnailSizes.map(size => /** @type {const} */ ([`x${ size }`, "assets/images/default-art.png"])))
  })
});

export default AlbumStructure;