import { Column } from "../library/db.js";

const ArtistStructure = Object.freeze({
  rowid: new Column("INTEGER", Infinity, { autoIncrement: true }),
  name: new Column("TEXT", 50),
  image: new Column("TEXT", 32, { defaultValue: "assets/images/default-artist.png" })
});

export default ArtistStructure;