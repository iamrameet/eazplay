import { DBFunction, Database, Query } from "../library/db.js";

const database = new Database("database2.db");

const tracksListView = new DBFunction(
  database,
  Query.define`SELECT`,
  {
   path: String,
   name: String
 }
);

export { tracksListView };