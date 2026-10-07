import { Column, Database, Table, View } from "../library/db.js";
import AlbumStructure from "../structures/albums.js";
import ArtistStructure from "../structures/artist.js";
import DirectoryStructure from "../structures/directory.js";
import TrackStructure from "../structures/tracks.js";

const database = new Database("database2.db");
await database.init();

await database.run(`PRAGMA foreign_keys = ON`);

const directories = new Table(database, "directories", DirectoryStructure, {
  primaryKey: /** @type {const} */ (["path"])
});

const artists = new Table(database, "artists", ArtistStructure);

const albums = new Table(database, "albums", AlbumStructure, {
  foreignKeys: {
    artist: artists.columnRef("rowid", {
      referentialActions: { onDelete: "cascade" }
    })
  }
});

const tracks = new Table(database, "tracks", TrackStructure, {
  primaryKey: /** @type {const} */ (["path"]),
  foreignKeys: {
    album: albums.columnRef("rowid", {
      referentialActions: { onDelete: "cascade" }
    })
  }
});

const trackArtists = new Table(database, "trackArtists", {
  artistId: new Column("INTEGER"),
  trackPath: new Column("TEXT")
}, {
  primaryKey: /** @type {const} */ (["trackPath", "artistId"]),
  foreignKeys: {
    artistId: artists.columnRef("rowid", {
      referentialActions: { onDelete: "cascade" }
    }),
    trackPath: tracks.columnRef("path", {
      referentialActions: { onDelete: "cascade" }
    })
  }
});

/** @type {View<"tracksListing", { [K in Exclude<keyof typeof tracks.allColumns, "album" | "codec" | "externalRefs">]: PrimitiveTypeMap[(typeof tracks.allColumns[K])["primitiveType"]["primitiveType"]] } & { artists: { id: number; name: string; }[]; album: { id: number; title: string; art: string; thumbnails: ReturnType<typeof albums.columns.thumbnails.parser> }; codec: ReturnType<typeof tracks.columns.codec.parser>; externalRefs: ReturnType<typeof tracks.columns.externalRefs.parser> }>} */
const tracksListing = new View(database, "tracksListing", `
  SELECT ${ tracks.columnsExcept([ "album" ], { tableAs: "t" }) },
  COALESCE(JSON_OBJECT('id', al.rowid, 'title', al.title, 'art', al.art, 'thumbnails', JSON(al.thumbnails)), 'null') AS album,
  COALESCE(JSON_GROUP_ARRAY(JSON_OBJECT('id', a.rowid, 'name', a.name)), '[]') AS artists
  FROM tracks t
  LEFT JOIN albums al ON t.album = al.rowid
  INNER JOIN trackArtists ta ON t.path = ta.trackPath
  INNER JOIN artists a ON ta.artistId = a.rowid
  GROUP BY t.rowid
`, {
  album: JSON.parse,
  artists: JSON.parse,
  codec: tracks.columns.codec.parser,
  externalRefs: tracks.columns.externalRefs.parser,
  liked: Boolean,
  explicit: Boolean,
  lossless: Boolean
});

/** @type {View<"albumsListing", { [K in Exclude<keyof typeof albums.allColumns, "artist">]: PrimitiveTypeMap[(typeof albums.allColumns[K])["primitiveType"]["primitiveType"]] } & { artist: { id: number; name: string; image: string }; tracks: { id: number; title: string }[] }>} */
const albumsListing = new View(database, "albumsListing", `
  SELECT ${
    albums.columnsExcept([ "artist" ], { tableAs: "a" })
  },
  COALESCE(JSON_GROUP_ARRAY(JSON_OBJECT('id', t.rowid, 'title', t.title)), '[]') AS tracks,
  COALESCE(JSON_OBJECT('id', ar.rowid, 'name', ar.name), 'null') AS artist
  FROM albums a
  INNER JOIN tracks t ON a.rowid = t.album
  LEFT JOIN artists ar ON ar.rowid = a.artist
  GROUP BY a.rowid;
`, {
  artist: JSON.parse,
  tracks: JSON.parse,
  thumbnails: albums.columns.thumbnails.parser
});

/** @type {View<"artistsListing", { [K in Exclude<keyof typeof artists.allColumns, "artist">]: PrimitiveTypeMap[(typeof artists.allColumns[K])["type"]["primitiveType"]] } & { tracks: { id: number; title: string }[] }>} */
const artistsListing = new View(database, "artistsListing", `
  SELECT ${ artists.columnsExcept([ "artist" ], { tableAs: "a" }) },
  COALESCE(JSON_GROUP_ARRAY(JSON_OBJECT('id', t.rowid, 'title', t.title)), '[]') AS tracks
  FROM artists a
  INNER JOIN trackArtists ta ON a.rowid = ta.artistId
  INNER JOIN tracks t ON t.path = ta.trackPath
  GROUP BY a.rowid
  ORDER BY a.name
`, {
  // artists: JSON.parse,
  tracks: JSON.parse
});

const Tables = { directories, artists, albums, tracks, trackArtists };
export const Views = { tracks: tracksListing, albums: albumsListing, artists: artistsListing };


for(const table of Object.values(Tables)) {
  // await table.drop({ ifExists: true });
  await table.create({ ifExists: false });
}

for(const view of Object.values(Views)) {
  await view.drop({ ifExists: true });
  await view.create({ ifExists: false });
}

console.table(await database.all(`PRAGMA foreign_keys`));

// console.table(await trackArtists.query`SELECT * FROM <this.name> WHERE artistId = ${ 3 };`);
// console.log(await artists.deleteBy("rowid", 3));
// console.table(await trackArtists.query`SELECT * FROM <this.name> WHERE artistId = ${ 3 };`);

export default Tables;