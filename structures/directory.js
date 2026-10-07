import { Column } from "../library/db.js";

const DirectoryStructure = Object.freeze({
  path: new Column("TEXT", Infinity, { required: true })
});

export default DirectoryStructure;