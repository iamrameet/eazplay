/// <reference path="./types.h.ts"/>

import sqlite3 from "sqlite3";
import Logger from "./logger.js";
import { construct, mapper } from "../common/util.js";

export class Database {

  /** @type {Map<string, Database>} */
  static #instances = new Map;

  #filename;
  #logger;
  /** @type {sqlite3.Database | null} */
  #database = null;

  /**
   * @param {string} filename
   * @param {{ logger: Logger; }} options
   */
  constructor(filename, options) {
    if(Database.#instances.has(filename)) {
      return Database.#instances.get(filename);
    }
    this.#filename = filename;
    this.#logger = options?.logger ?? new Logger(`Database<${ filename }>`);
    Database.#instances.set(this.#filename, this);
  }

  get database() {
    return this.#database;
  }
  get logger() {
    return this.#logger;
  }

  async init() {
    await new Promise((resolve, reject) => {
      if(this.#database !== null) {
        return;
      }
      this.#database = new sqlite3.Database(this.#filename, function(error) {
        if(error === null) {
          return void resolve();
        }
        reject(error);
      });
    });
    if(!Database.#instances.has(this.#filename)) {
      Database.#instances.set(this.#filename, this);
    }
    return this;
  }

  async close() {
    this.#database = await new Promise((resolve, reject) => this.#database.close(function(error) {
      if(error) {
        return void reject(error);
      }
      resolve(null);
    }));
    Database.#instances.delete(this.#filename);
  }

  /**
   * @param {string} query
   * @param {[]} [params]
   * @returns {Promise<sqlite3.RunResult>}
  */
  async run(query, params = []) {
    this.#logger.log(query, params);
    return await new Promise((resolve, reject) => {
      this.database.run(query, params, function(error) {
        if(error === null) {
          return void resolve(this);
        }
        reject(error);
      });
    });
  }

  /**
   * @template T
   * @param {string} query
   * @param {[]} [params]
   * @returns {Promise<T[]>}
  */
  async all(query, params = []) {
    this.#logger.log(query, params);
    return await new Promise((resolve, reject) => {
      this.database.all(query, params, function(error, rows) {
        if(error === null) {
          return void resolve(rows);
        }
        reject(error);
      });
    });
  }

  /**
   * @param {string} query
   * @param {[]} [params]
  */
  async get(query, params = []) {
    // this.#logger.log(query, params);
    return await new Promise((resolve, reject) => {
      this.database.get(query, params, function(error, row) {
        if(error === null) {
          return void resolve(row);
        }
        reject(error);
      });
    });
  }

};

/**
 * @template {new (...args: any[]) => any} T
 * @template {PrimitiveTypeNames} P
 */
class Type {
  /**
   * @param {T} inbuiltType
   * @param {P} primitiveType
   */
  constructor(inbuiltType, primitiveType) {
    this.inbuiltType = inbuiltType;
    this.primitiveType = primitiveType;
  }
};

class Types {
  /** @readonly */ static INTEGER = new Type(Number, "number");
  /** @readonly */ static REAL = new Type(Number, "number");
  /** @readonly */ static BOOLEAN = new Type(Boolean, "boolean");
  /** @readonly */ static TEXT = new Type(String, "string");
  /** @readonly */ static BLOB = new Type(Blob, "object");
  /** @readonly */ static NULL = new Type(null, "object");
  /** @readonly */ static DATE = new Type(String, "number");
  /** @readonly */ static TIME = new Type(String, "number");
  /** @readonly */ static DATETIME = new Type(Date, "object");
};

/**
 * @template {Exclude<keyof typeof Types, keyof Function>} Type
 * @template {number} [Size=number]
 * @template {boolean} [Required=boolean]
 * @template {boolean} [Unique=boolean]
 * @template {any} [Serialized=PrimitiveTypeMap[typeof Types[Type]["primitiveType"]]]
 */
export class Column {

  /** @readonly */
  static OBJECT = Symbol();

  #serializer;
  #parser;

  /**
   * @param {Type} type
   * @param {Size} size
   * @param {{ required?: Required; unique?: Unique; defaultValue?: PrimitiveTypeMap[typeof Types[Type]["primitiveType"]]; enclosures?: [preceding: string, succeeding: string]; autoIncrement?: Type extends "INTEGER" ? boolean : never; serializer?: (value: Serialized) => PrimitiveTypeMap[typeof Types[Type]["primitiveType"]]; parser?: (value: PrimitiveTypeMap[typeof Types[Type]["primitiveType"]]) => Serialized }} options
  */
  constructor(type, size, options) {
    this.type = type ?? "TEXT";
    this.size = size ?? Infinity;
    /** @type {Unique extends true ? true : false} */
    this.unique = options?.unique ?? false;
    /** @type {Required extends true ? true : false} */
    this.required = options?.required ?? false;
    this.defaultValue = options?.defaultValue;
    /** @type {[preceding: string, succeeding: string]} */
    this.enclosures = options?.enclosures ?? construct(Array, 2).fill(this.type === "Text" ? "\"" : "");
    this.autoIncrement = this.type === "INTEGER" ? options?.autoIncrement ?? false : false;
    this.#serializer = options?.serializer ?? mapper(this.type, {
      BOOLEAN: Number,
      DATETIME: Number
    }, value => value);
    this.#parser = options?.parser ?? mapper(this.type, {
      BOOLEAN: Boolean,
      DATETIME: value => new Date(value)
    }, value => value)
  }

  get primitiveType() {
    return Types[this.type];
  }

  /** @param {PrimitiveTypeMap[typeof Types[Type]["primitiveType"]]} value */
  parse(value) {
    return this.#parser(value);
  }

  /** @param {Serialized} value */
  serialise(value) {
    return this.#serializer(value);
  }

  /**
   * same as `Column.prototype.parse` but binded with `Column`
   * @returns {this["parse"]}
   */
  get parser() {
    return this.#parser.bind(this);
  }

  /** @param {Partial<Column>} object */
  static from(object) {
    return new Column(object.type, object.size, {
      required: object.required,
      unique: object.unique,
      defaultValue: object.defaultValue,
      autoIncrement: object.autoIncrement,
      enclosures: object.enclosures
    });
  }

  /** @returns {this[typeof Column.OBJECT] extends (...args: any[]) => infer R ? R : this & { primitiveType: typeof Types[Type]["primitiveType"] }} */
  toObject() {
    return this[Column.OBJECT]?.() ?? {
      ...this,
      primitiveType: Types[this.type].primitiveType
    };
  }

};

export class Columns {

  static JSON;

  static {

    /**
     * @template {{}} [T={}]
     * @template {boolean} [Required=false]
     * @template {boolean} [Unique=false]
     * @extends {Column<"TEXT", number, Required, Unique, T>}
     */
    class JSON extends Column {
      /** @param {{ required?: Required; unique?: Unique; defaultValue?: T }} options  */
      constructor(options) {
        super("TEXT", Infinity, {
          defaultValue: globalThis.JSON.stringify(options?.defaultValue ?? {}),
          required: options?.required,
          unique: options?.unique,
          parser(text) {
            return globalThis.JSON.parse(text);
          },
          serializer(value) {
            return globalThis.JSON.stringify(value);
          }
        });
      }
      [Column.OBJECT]() {
        return {
          ...this,
          primitiveType: "object"
        };
      }
    };

    this.JSON = JSON;

  }
};

class DatabaseEntity {

  #database;

  /** @param {Database} database database instance */
  constructor(database) {
    this.#database = database;
  }

  get database() {
    return this.#database;
  }

};

export class Symbols {

  /** @readonly */ static AND = "AND";
  /** @readonly */ static OR = "OR";
  /** @readonly */ static NOT = "!=";
  /** @readonly */ static EQUAL = "==";
  /** @readonly */ static GT = ">";
  /** @readonly */ static LT = "<";
  /** @readonly */ static GTEQUAL = ">=";
  /** @readonly */ static LTEQUAL = "<=";
  /** @readonly */ static IN = "IN";
  /** @readonly */ static NOTIN = "NOT IN";
  /** @readonly */ static LIKE = "LIKE";

};

/** @typedef {{ rowid: Column<"INTEGER", 64, false, true, number>; createdAt: Column<"DATETIME", number, false, false, Date>; updatedAt: Column<"DATETIME", number, false, false, Date> }} DefaultColumns */

/**
 * @template {{ [key: string]: Column }} T
 * @typedef {DefaultColumns & T} AllColumns
*/

/**
 * @template {Column} T
 * @typedef {ReturnType<T["parser"]>} ColumnValueType
*/

/**
 * @template {Table} [T=Table]
 * @template {T extends Table<string, infer C> ? keyof C : never} K
*/
class ForeignKey {

  #table;
  #column;
  #referentialActions;

  /**
   * @param {T} table
   * @param {K} column
   * @param {{ referentialActions?: { onDelete?: ReferentialAction; onUpdate?: ReferentialAction } }} [options]
   */
  constructor(table, column, options = {}) {
    this.#table = table;
    this.#column = column;
    this.#referentialActions = Object.freeze({
      onDelete: options?.referentialActions?.onDelete,
      onUpdate: options?.referentialActions?.onUpdate
    });
  }

  get table() {
    return this.#table;
  }

  get column() {
    return this.#column;
  }

  get referentialActions() {
    return this.#referentialActions;
  }

  /**
   * @template {"onDelete" | "onUpdate"} K
   * @param {K} event
   */
  hasReferentialAction(event) {
    return this.#referentialActions[event] !== undefined;
  }

  /**
   * @template {"onDelete" | "onUpdate"} K
   * @param {K} event
   */
  getReferentialAction(event) {
    return this.#referentialActions[event];
  }

  static ReferentialAction;

  static {
    this.ReferentialAction = Object.freeze({
      cascade: "CASCADE",
      setNull: "SET NULL",
      setDefault: "SET DEFAULT",
      restrict: "RESTRICT"
    });
  };

};


/** @typedef {keyof typeof ForeignKey.ReferentialAction} ReferentialAction */

/**
 * @template {string} N
 * @template {{ [key: string]: Column }} T
 * @template {(keyof AllColumns<T>)[]} [P=[]]
 * @template {{ [K in keyof T]?: ForeignKey }} F
 */
export class Table extends DatabaseEntity {

  #name;
  #columns;
  /** @type {P} */
  #primaryKey;
  /** @type {F} */
  #foreignKeys;

  /**
   * @param {Database} database database instance
   * @param {N} name
   * @param {T} columns
   * @param {{ primaryKey?: P; foreignKeys?: F }} constraints
   */
  constructor(database, name, columns, constraints) {
    super(database);
    this.#name = name;
    this.#columns = Object.fromEntries(Object.entries(columns).map(([ name, column ]) => {
      const columnInstance = column instanceof Column ? column : Column.from(column);
      return /** @type {[columnName: string, column: Column]} */ ([ name, columnInstance ]);
    }));
    this.#columns["createdAt"] = new Column("DATETIME", Infinity);
    this.#columns["updatedAt"] = new Column("DATETIME", Infinity);
    this.#primaryKey = Array.from(new Set(constraints?.primaryKey ?? []));
    this.#foreignKeys = constraints?.foreignKeys ?? {};
  }

  /** @returns {AllColumns<T>} */
  get allColumns() {
    return Object.assign({
      rowid: new Column("INTEGER", Infinity, { autoIncrement: true })
    }, this.#columns);
  }

  /** @returns {{ [K in keyof T]: T[K] }} */
  get columns() {
    return this.#columns;
  }

  /** @returns {{ [K in keyof T]: ReturnType<T[K]["toObject"]> }} */
  get structure() {
    return Object.fromEntries(Object.entries(this.#columns).map(entry => /** @type {const} */ ([ entry[0], entry[1].toObject()])));
  }

  get primaryKey() {
    return this.#primaryKey;
  }

  /**
   * @template {(keyof AllColumns<T>)[]} C
   * @param {C} columns
   * @param {{ tableAs?: string; columnsAs?: { [K in Exclude<keyof AllColumns<T>, C>]: string } }} [options]
   */
  columnsExcept(columns, options) {
    const columnsSet = new Set(columns);
    const columnsAs = options?.columnsAs ?? {};
    const columnPrefix = options?.tableAs === undefined ? "" : `${ options.tableAs }.`;

    const filteredColumns = [];
    for(const columnName in this.allColumns) {
      if(columnsSet.has(columnName)) {
        continue;
      }
      const columnAs = columnName in columnsAs ? ` AS ${ columnsAs[columnName] }` : "";
      filteredColumns.push(`${ columnPrefix }${ columnName }${ columnAs }`);
    }
    return filteredColumns.join(", ");
  }

  /**
   * @template {keyof AllColumns<T>} K
   * @param {K} column
   * @param {{ referentialActions?: { onDelete?: ReferentialAction; onUpdate?: ReferentialAction } }} [options]
   * @returns {ForeignKey<this, K>}
   */
  columnRef(column, options) {
    return new ForeignKey(this, column, options);
  }

  /** @param {RequiredColumns<AllColumns<T>> & OptionalColumns<AllColumns<T>>} row */
  completeRecord(row) {
    for(const [ columnName, column ] of Object.entries(this.#columns)) {
      if(columnName in row === false) {
        row[columnName] = column.defaultValue ?? null;
      }
    }
    return row;
  }

  /**
   * @param {TemplateStringsArray} strings
   * @param {any[]} params
   */
  async query(strings, ...params) {
    let query = strings[0];
    for(const index of params.keys()) {
      query += "?" + strings[index + 1];
    }
    return await this.database.all(query.replace(/\<this\.name\>/, this.#name), params);
  }

  async desc() {
    return await this.database.all(`PRAGMA table_info(${ this.#name })`);
  }

  /** @param {{ ifExists?: boolean }} options */
  async drop(options) {
    return await this.database.run(`DROP TABLE${
      options?.ifExists ? " IF EXISTS" : ""
    } ${ this.#name }`);
  }

  async truncate() {
    return await this.database.run(`DELETE FROM ${ this.#name }`);
  }

  /** @param {{ ifExists?: boolean }} options */
  async create(options) {
    const columns = Object.entries(this.#columns).map(([ name, column ]) => {
      const hasDefaultValue = column.defaultValue !== undefined;
      return /** @type {const} */ (`${ name } ${ column.type }${
        Number.isFinite(column.size) ? `(${ column.size })` : ""
      }${
        hasDefaultValue ? ` DEFAULT '${ column.defaultValue }'` : ""
      }${
        column.unique ? " UNIQUE" : ""
      }${
        column.required ? " NOT NULL" : ""
      }${
        column.autoIncrement ? " PRIMARY KEY AUTOINCREMENT" : ""
      }`);
    });

    if(this.#primaryKey.length > 0) {
      columns.push(`PRIMARY KEY (${ this.#primaryKey.join(", ") })`);
    }

    for(const [column, foreignKey] of Object.entries(this.#foreignKeys)) {
      columns.push(`FOREIGN KEY (${ column }) REFERENCES ${ foreignKey.table.#name }(${ foreignKey.column })${
        foreignKey.hasReferentialAction("onDelete")
          ? ` ON DELETE ${ ForeignKey.ReferentialAction[foreignKey.getReferentialAction("onDelete")] }`
          : ""
      }${
        foreignKey.hasReferentialAction("onUpdate")
          ? ` ON UPDATE ${ ForeignKey.ReferentialAction[foreignKey.getReferentialAction("onUpdate")] }`
          : ""
      }`);
    }

    const query = `CREATE TABLE${
      options?.ifExists ? "" : " IF NOT EXISTS"
    } ${ this.#name } (${ columns.join(", ") })`;
    const result = await this.database.run(query);
    return result.changes;
  }

  /**
   * @param {(RequiredColumns<AllColumns<T>> & OptionalColumns<AllColumns<T>>)[]} rows
   * @param {{ conflictResolution?: "ignore" | "replace" }} options
   */
  async insertMany(rows, options = {}) {
    if(rows.length === 0) {
      return -1;
    }
    const createdAt = Date.now();
    let [ firstRow, ...restRows ] = rows;
    firstRow = Object.assign({}, firstRow, { createdAt, updatedAt: createdAt });
    const columns = Object.keys(firstRow);
    let query = `INSERT${
      mapper(options?.conflictResolution, {
        ignore: " OR IGNORE",
        replace: " OR REPLACE"
      }, "")
    } INTO ${ this.#name }(${ columns.join(", ") }) VALUES`;
    const columnValues = [];
    const params = Object.entries(firstRow).flatMap(entry => {
      if(entry[1] instanceof Array) {
        columnValues.push(entry[1][0]);
        return entry[1][1];
      }
      columnValues.push("?");
      return this.#columns[entry[0]]?.serialise(entry[1]);
    });
    query += `(${ columnValues.join(", ") })`;

    for(let row of restRows) {
      row = Object.assign({}, row, { createdAt, updatedAt: createdAt });
      const columnValues = [];
      params.push(...Object.entries(row).flatMap(entry => {
        if(entry[1] instanceof Array) {
          columnValues.push(entry[1][0]);
          return entry[1][1];
        }
        columnValues.push("?");
        return this.#columns[entry[0]]?.serialise(entry[1]);
      }));
      query += `, (${ columnValues.join(", ") })`;
    }
    const result = await this.database.run(query, params);
    return result.lastID;
  }

  /**
   * @param {RequiredColumns<AllColumns<T>> & OptionalColumns<AllColumns<T>>} row
   * @param {{ conflictResolution?: "ignore" | "replace" }} [options]
   */
  async insert(row, options) {
    return await this.insertMany([ row ], options);
  }

  /**
   * get the record using primary key
   * @param {{ [K in keyof P]: ColumnValueType<AllColumns<T>[P[K]]> }} values
   * @returns {Promise<{ [K in keyof AllColumns<T>]: ColumnValueType<AllColumns<T>[K]> }>}
   */
  async get(...values) {
    const record = await this.database.get(`SELECT * FROM ${ this.#name } WHERE ${
      this.#primaryKey.map(columnName => `${ columnName } = ?`).join(" AND ")
    }`, values);
    if(record === undefined) {
      return;
    }
    for(const column in record) {
      record[column] = this.#columns[column].parse(record[column]);
    }
    return record;
  }

  /**
   * get the record using unique key
   * @template {keyof { [K in keyof AllColumns<T> as AllColumns<T>[K]["unique"] extends true ? K : never]: K }} K
   * @param {K} column
   * @param {ColumnValueType<AllColumns<T>[K]>} value
   * @returns {Promise<{ [K in keyof AllColumns<T>]: ColumnValueType<AllColumns<T>[K]> }>}
   */
  async getBy(column, value) {
    return await this.database.get(`SELECT * FROM ${ this.#name } WHERE ${ column } = ?`, [ value ]);
  }

  /**
   * @template {(keyof AllColumns<T>)[]} [C=[]]
   * @param {{ columns?: C; where?: ConditionalClause<AllColumns<T>> | [ symbol: typeof Symbols.OR | typeof Symbols.AND, values: ConditionalClause<AllColumns<T>>[] ]; orderBy?: [column: keyof AllColumns<T>, order?: 1 | -1][]; limit?: number; offset?: number }} options
   * @returns {Promise<{ [K in Extract<keyof AllColumns<T>, C["length"] extends 0 ? string : C[number] extends never ? string : C[number]>]: ColumnValueType<AllColumns<T>[K]> }[]>}
   */
  async select(options = {}) {
    const params = [];
    let query = `SELECT ${
      "columns" in options === false || options.columns.length === 0 ? "*" : options.columns.join(", ")
    } FROM ${ this.#name }`;
    if("where" in options) {
      const [whereQuery, ...args] = this.#handleWhereClause(options.where);
      params.push(...args);
      query += ` WHERE ${ whereQuery }`;
    }
    if("orderBy" in options) {
      query += ` ORDER BY ${
        options.orderBy.map(([column, order]) => {
          return `${ column } ${ order === -1 ? "DESC" : "ASC" }`;
        }).join(", ")
      }`;
    }
    if("limit" in options) {
      query += ` LIMIT ${ options.limit }`;
      if("offset" in options) {
        query += ` OFFSET ${ options.offset }`;
      }
    }
    const records = await this.database.all(query, params);
    for(const record of records) {
      for(const column in record) {
        record[column] = column in this.#columns ? this.#columns[column].parse(record[column]) : record[column];
      }
    }
    return records;
  }

  /**
   * @param {ColumnValues<AllColumns<T>>} columns
   * @param {{ where?: ConditionalClause<AllColumns<T>> | [ symbol: typeof Symbols.OR | typeof Symbols.AND, values: ConditionalClause<AllColumns<T>>[] ]; limit?: number; }} options
   */
  async update(columns, options = {}) {
    columns = Object.assign({}, columns, { updatedAt: Date.now() });
    const params = Object.entries(columns).map(entry => this.#columns[entry[0]].serialise(entry[1]));
    let query = `UPDATE ${ this.#name } SET ${
      Object.keys(columns).map(columnName => `${ columnName } = ?`).join(", ")
    }`;
    if("where" in options) {
      const [whereQuery, ...args] = this.#handleWhereClause(options.where);
      params.push(...args);
      query += ` WHERE ${ whereQuery }`;
    }
    if("limit" in options) {
      query += ` LIMIT ${ options.limit }`;
    }
    const result = await this.database.run(query, params);
    return result.changes;
  }

  /**
   * update the record using unique key
   * @template {keyof { [K in keyof AllColumns<T> as AllColumns<T>[K]["unique"] extends true ? K : never]: K }} K
   * @param {K} column
   * @param {ColumnValueType<AllColumns<T>[K]>} value
   * @param {ColumnValues<AllColumns<T>>} columns
   */
  async updateBy(column, value, columns) {
    return await this.update(columns, {
      where: [ Symbols.EQUAL, column, value ]
    });
  }

  /** @param {{ where?: ConditionalClause<AllColumns<T>> | [ symbol: typeof Symbols.OR | typeof Symbols.AND, values: ConditionalClause<AllColumns<T>>[] ]; limit?: number; }} options */
  async delete(options = {}) {
    const params = [];
    let query = `DELETE FROM ${ this.#name }`;
    if("where" in options) {
      const [whereQuery, ...args] = this.#handleWhereClause(options.where);
      params.push(...args);
      query += ` WHERE ${ whereQuery }`;
    }
    if("limit" in options) {
      query += ` LIMIT ${ options.limit }`;
    }
    const result = await this.database.run(query, params);
    return result.changes;
  }

  /**
   * delete the record using unique key
   * @template {keyof { [K in keyof AllColumns<T> as AllColumns<T>[K]["unique"] extends true ? K : never]: K }} K
   * @param {K} column
   * @param {ColumnValueType<AllColumns<T>[K]>} value
   */
  async deleteBy(column, value) {
    return await this.delete({
      where: [ Symbols.EQUAL, column, value ]
    });
  }

  /**
   * @template {keyof AllColumns<T>} K
   * @param {K} column
   * @param {{ where?: ConditionalClause<AllColumns<T>> | [ symbol: typeof Symbols.OR | typeof Symbols.AND, values: ConditionalClause<AllColumns<T>>[] ]; orderBy?: [column: keyof AllColumns<T>, order?: 1 | -1][]; limit?: number; offset?: number }} options
   * @returns {SelectSubQuery<ColumnValueType<AllColumns<T>[K]>>}
   */
  selectSubQuery(column, options) {
    const params = [];
    let query = `(SELECT ${ column } FROM ${ this.#name }`;
    if("where" in options) {
      const [whereQuery, ...args] = this.#handleWhereClause(options.where);
      params.push(...args);
      query += ` WHERE ${ whereQuery }`;
    }
    if("orderBy" in options) {
      query += ` ORDER BY ${
        options.orderBy.map(([column, order]) => {
          return `${ column } ${ order === -1 ? "DESC" : "ASC" }`;
        }).join(", ")
      }`;
    }
    query += ")";
    return [ query, params ];
  }

  /**
   * @param {ConditionalClause<AllColumns<T>> | [ symbol: typeof Symbols.OR | typeof Symbols.AND, values: ConditionalClause<AllColumns<T>>[] ]} clauseData
   * @returns {[ query: string; ...params: [] ]}
   */
  #handleWhereClause(clauseData) {
    if(typeof clauseData === "string") {
      return [ clauseData ];
    }
    const symbol = clauseData[0];
    switch(symbol) {
      case Symbols.EQUAL:
      case Symbols.NOT:
      case Symbols.GT:
      case Symbols.GTEQUAL:
      case Symbols.LT:
      case Symbols.LTEQUAL:
      case Symbols.LIKE: {
        const column = clauseData[1];
        const value = clauseData[2];
        if(value instanceof Array) {
          return [`${ column } ${ symbol } ${ value[0] }`, ...value[1]];
        }
        return [`${ column } ${ symbol } ?`, value];
      }
      case Symbols.IN:
      case Symbols.NOTIN: {
        const column = clauseData[1];
        if(typeof clauseData[2][0] === "string" && clauseData[2][1] instanceof Array) {
          return [`${ column } ${ symbol } ${ clauseData[2][0] }`, ...clauseData[2][1]];
        }
        const values = Array.from(new Set(clauseData[2]));
        return [`${ column } ${ symbol } (${ values.map(() => "?").join(", ") })`, ...values];
      }
      case Symbols.AND:
      case Symbols.OR: {
        const params = [];
        return [
          `(${ clauseData[1].map(data => {
            const [ query, ...args ] = this.#handleWhereClause(data);
            params.push(...args);
            return query;
          }).join(` ${ symbol } `) })`,
          ...params
        ];
      }
    }
  }

  /**
   * @template {InstanceType<typeof Table>} T1
   * @param {T1} table
   * @param {[ column: keyof this["columns"], column: keyof T1["columns"] ]} on
   */
  innerJoin(table, on) {
    const query = `INNER JOIN ${ table.#name } ON t1.${ on[0] } = t2.${ on[1] }`;
    /** @type {{ [K in keyof T as `${ N }.${ K }`]: T[K] } & { [K in keyof TableColumns<T1> as `${ TableName<T1> }.${ K }`]: TableColumns<T1>[K] } }} */
    const columns = Object.fromEntries(Array.from(Object.entries(this.#columns)).map(([name, column]) => {
      return /** @type {const} */ ([ `${ this.#name }.${ name }`, column ]);
    }));
    return new Table(this.database, `${ this.#name }-${ table.#name }`, columns);
  }

};

/**
 * @template {string} N
 * @template {{ [K: string]: any }} T
 */
export class View extends DatabaseEntity {

  #name;
  #query;
  #parsers;

  /**
   * @param {Database} database database instance
   * @param {N} name
   * @param {string} query
   * @param {{ [K in keyof T]?: (value: string | number) => T[K] }} [parsers]
   */
  constructor(database, name, query, parsers) {
    super(database);
    this.#name = name;
    this.#query = query;
    this.database.logger.log(query);
    this.#parsers = Object.assign({
      createdAt: value => new Date(value),
      updatedAt: value => new Date(value)
    }, parsers);
  }

  /** @param {{ ifExists?: boolean }} options */
  async drop(options) {
    return await this.database.run(`DROP VIEW${
      options?.ifExists ? " IF EXISTS" : ""
    } ${ this.#name }`);
  }

  /** @param {{ ifExists?: boolean }} options */
  async create(options) {
    const query = `CREATE VIEW${ options?.ifExists ? "" : " IF NOT EXISTS" } ${ this.#name } AS ${ this.#query }`;
    const result = await this.database.run(query);
    return result.changes;
  }


  /**
   * @param {TemplateStringsArray} strings
   * @param {any[]} params
   * @returns {Promise<T[]>}
   */
  async query(strings, ...params) {
    let query = strings[0];
    for(const index of params.keys()) {
      query += "?" + strings[index + 1];
    }
    const records = await this.database.all(query.replace(/\<this\.name\>/, this.#name), params);
    return this.#parseRecords(records);
  }

  /**
   * @param {ConditionalClause<AllColumns<T>> | [ symbol: typeof Symbols.OR | typeof Symbols.AND, values: ConditionalClause<AllColumns<T>>[] ]} whereClause
   * @param {{ orderBy?: [column: keyof AllColumns<T>, order?: 1 | -1][]; limit?: number; offset?: number }} options
   */
  async where(whereClause, options = {}) {
    const params = [];
    let query = `SELECT * FROM ${ this.#name }`;
    if(whereClause) {
      const [whereQuery, ...args] = this.#handleWhereClause(whereClause);
      params.push(...args);
      query += ` WHERE ${ whereQuery }`;
    }
    if("orderBy" in options) {
      query += ` ORDER BY ${
        options.orderBy.map(([column, order]) => {
          return `${ column } ${ order === -1 ? "DESC" : "ASC" }`;
        }).join(", ")
      }`;
    }
    if("limit" in options) {
      query += ` LIMIT ${ options.limit }`;
      if("offset" in options) {
        query += ` OFFSET ${ options.offset }`;
      }
    }
    this.database.logger.log(query)
    const records = await this.database.all(query, params);
    return this.#parseRecords(records);
  }

  /** @returns {Promise<T[]>} */
  async all() {
    const records = await this.database.all(`SELECT * FROM ${ this.#name }`);
    return this.#parseRecords(records);
  }

  /**
   * @param {ConditionalClause<AllColumns<T>> | [ symbol: typeof Symbols.OR | typeof Symbols.AND, values: ConditionalClause<AllColumns<T>>[] ]} [whereClause]
   */
  async count(whereClause) {
    let query = `SELECT COUNT(*) AS count FROM ${ this.#name }`;
    let params;
    if(whereClause) {
      const [whereQuery, ...whereParams] = this.#handleWhereClause(whereClause);
      params = whereParams;
      query += ` WHERE ${ whereQuery }`;
    }
    /** @type {{ count: number }} */
    const record = await this.database.get(query, params);
    return record.count;
  }

  /** @returns {Promise<T[]>} */
  #parseRecords(records = []) {
    for(const record of records) {
      for(const column in this.#parsers) {
        if(record[column] !== null) {
          record[column] = this.#parsers[column](record[column]);
        }
      }
    }
    return records;
  }

  async getStructure() {
    /** @type {{ cid: number; dflt_value: ?T[keyof T]; name: keyof T; notnull: 0 | 1; pk: 0 | 1; type: Exclude<keyof typeof Types, keyof Function> }[]} */
    const rows = await this.database.all(`PRAGMA table_info(${ this.#name })`);
    /** @type {{ [K in keyof T]: { _type: T[K]; primitiveType: PrimitiveTypeMap[T[K]]; required: boolean; defaultValue: ?any } } & { rowid: { primitiveType: "number"; required: true; defaultValue: null } }} */
    const structure = {
      rowid: { primitiveType: "number", required: true },
      createdAt: { primitiveType: "object", required: true },
      updatedAt: { primitiveType: "object", required: true }
    };
    for(const row of rows) {
      const indexOfBracket = row.type.indexOf("(");
      if(indexOfBracket !== -1) {
        row.type = row.type.substring(0, indexOfBracket);
      }
      const primitiveType = row.name in this.#parsers ? (typeof this.#parsers[row.name]("{}")) : (Types[row.type]?.primitiveType ?? "object");
      structure[row.name] = {
        primitiveType,
        required: Boolean(row.notnull),
        defaultValue: row.dflt_value
      };
    }
    return structure;
  }


  /**
   * @param {ConditionalClause<AllColumns<T>> | [ symbol: typeof Symbols.OR | typeof Symbols.AND, values: ConditionalClause<AllColumns<T>>[] ]} clauseData
   * @returns {[ query: string; ...params: [] ]}
   */
  #handleWhereClause(clauseData) {
    const symbol = clauseData[0];
    switch(symbol) {
      case Symbols.EQUAL:
      case Symbols.NOT:
      case Symbols.GT:
      case Symbols.GTEQUAL:
      case Symbols.LT:
      case Symbols.LTEQUAL:
      case Symbols.LIKE: {
        const column = clauseData[1];
        const value = clauseData[2];
        if(value instanceof Array) {
          return [`${ column } ${ symbol } ${ value[0] }`, ...value[1]];
        }
        return [`${ column } ${ symbol } ?`, value];
      }
      case Symbols.IN:
      case Symbols.NOTIN: {
        const column = clauseData[1];
        if(typeof clauseData[2][0] === "string" && clauseData[2][1] instanceof Array) {
          return [`${ column } ${ symbol } ${ clauseData[2][0] }`, ...clauseData[2][1]];
        }
        const values = Array.from(new Set(clauseData[2]));
        return [`${ column } ${ symbol } (${ values.map(() => "?").join(", ") })`, ...values];
      }
      case Symbols.AND:
      case Symbols.OR: {
        const params = [];
        return [
          `(${ clauseData[1].map(data => {
            const [ query, ...args ] = this.#handleWhereClause(data);
            params.push(...args);
            return query;
          }).join(` ${ symbol } `) })`,
          ...params
        ];
      }
    }
  }

};

/** @typedef {ReturnType<typeof Query.param>} QueryParameterType */

/** @template {QueryParameterType[]} T */
export class Query {

  #queryString;
  #params;

  /**
   * @param {string} queryString
   * @param {T} params
   */
  constructor(queryString, params) {
    this.#queryString = queryString;
    this.#params = params;
  }

  /**
   * @param {{ [K in Exclude<keyof T, keyof Array> as T[K]["defaultValue"] extends undefined ? never : T[K]["name"] ]?: InstanceType<T[K]["type"]> } & { [K in Exclude<keyof T, keyof Array> as T[K]["defaultValue"] extends undefined ? T[K]["name"]: never ]: InstanceType<T[K]["type"]> }} args
   * @returns {[ queryString: string, queryParams: { [K in keyof T]: InstanceType<T[K]["type"]> } ]}
   */
  build(args) {
    const queryParams = this.#params.map(param => {
      if(param.name in args === false) {
        if(param.defaultValue !== undefined) {
          throw `Query.build requires parameter '${ param.name }'`;
        }
        return param.defaultValue;
      }
      return args[param.name];
    });
    return [ this.#queryString, queryParams ];
  }

  /**
   * @template {(string | QueryParameterType)[]} T
   * @param {TemplateStringsArray} strings
   * @param {T} params
   * @returns {Query<{ [K in keyof T]: T[K] extends string ? ReturnType<typeof Query.param<T[K], StringConstructor>> : T[K] }>}
   */
  static define(strings, ...params) {
    return new Query(strings.join("?"), params.map(param => typeof param === "string" ? Query.param(param, String) : param));
  }

  /**
   * @template {string} N
   * @template {new (...args: any) => any} T
   * @template {InstanceType<T> | undefined} [V=undefined]
   * @param {N} name
   * @param {T} type
   * @param {V} defaultValue
   */
  static param(name, type, defaultValue) {
    return { name, type, defaultValue };
  }

};

/**
 * @template {Query} Q
 * @template {{ [column: string]: (value: string | number) => any }} T
 */
export class DBFunction extends DatabaseEntity {

  #query;
  #parsers;

  /**
   * @param {Database} database
   * @param {Q} query
   * @param {T} parsers
   */
  constructor(database, query, parsers) {
    super(database);
    this.#query = query;
    this.#parsers = parsers;
  }

  /** @type {(...args: Parameters<Q["build"]>) => Promise<{ [K in keyof T]: ReturnType<T[K]> }[]>} */
  async run(args) {
    const queryBuild = this.#query.build(args);
    const records = await this.database.all(...queryBuild);
    for(const record of records) {
      for(const column in this.#parsers) {
        record[column] = this.#parsers[column](record[column]);
      }
    }
    return records;
  }

};


/**
 * @template {{ [name: string]: Column }} T
 * @typedef {[ symbol: typeof Symbols.GT | typeof Symbols.LT | typeof Symbols.GTEQUAL | typeof Symbols.LTEQUAL, column: keyof FilterColumnValues<T, number>, value: number | SelectSubQuery<number> ] | [ symbol: typeof Symbols.NOT | typeof Symbols.EQUAL, column: keyof ColumnValues<T>, value: string | SelectSubQuery<string> ] | [ symbol: typeof Symbols.LIKE, column: keyof FilterColumnValues<T, number>, value: string ] | [ symbol: typeof Symbols.IN, column: keyof ColumnValues<T>, values: string[] ]} ConditionalClause
 */

/**
 * @template {{ [name: string]: Column }} T
 * @typedef {{ [K in keyof T]?: ColumnValueType<T[K]> }} ColumnValues
 */
/**
 * @template {{ [name: string]: Column }} T
 * @template {PrimitiveTypes} F
 * @typedef {{ [K in keyof T as ColumnValueType<T[K]> extends F ? K : never]?: ColumnValueType<T[K]> }} FilterColumnValues
 */
/**
 * @template {{ [name: string]: Column }} T
 * @typedef {{ [K in keyof T as T[K]["required"] extends true ? K : never]: ColumnValueType<T[K]> }} RequiredColumns
 */
/**
 * @template {{ [name: string]: Column }} T
 * @typedef {{ [K in keyof T as T[K]["required"] extends true ? never : K]?: ColumnValueType<T[K]> | SelectSubQuery<ColumnValueType<T[K]>> }} OptionalColumns
 */

/**
 * @template T
 * @typedef {[ query: string, params: any[] ]} SelectSubQuery
 */

/**
 * @template {InstanceType<Table>} T
 * @typedef {T extends Table<infer M, infer C, infer P, infer F> ? M : string} TableName
*/

/**
 * @template {InstanceType<Table>} T
 * @typedef {T extends Table<infer M, infer C, infer P, infer F> ? C : {}} TableColumns
*/