import { writeFile, appendFile, stat } from "fs/promises";

/** @template {string} T */
export default class Logger {

  /** @enum */
  static Level = /** @type {const} */ ({
    NONE: 0,
    LOG: 1,
    WARN: 2,
    ERROR: 4,
    ALL: 7
  });

  static #level = this.Level.ALL;
  static #types = new Set;
  static #dirname;
  static #path = "data/logs/";
  static #testing = false;
  static #fileName = this.#getTime(true);
  /** @type {{ logType: typeof Logger.Level[keyof typeof Logger.Level]; time: string; type: string; args: any[] }[]} */
  static #preInitQueue = [];

  static get fileName(){
    return this.#path + this.#fileName + ".log";
  }

  static set dirname(value) {
    this.#dirname = value.replace(/\\/g, "/");
  }
  /** @param {boolean} value */
  static set testing(value){
    this.#testing = Boolean(value);
    this.#fileName = this.#testing ? "test" : this.#getTime(true);
  }
  /** @param {string} path */
  static set logsDirectory(path){
    this.#path = path + (path.at(-1) === "/" ? "" : "/");
  }

  /** @param {typeof Logger.Level[keyof typeof Logger.Level]} value */
  static set level(value){
    if(value >= this.Level.NONE && value <= this.Level.ALL){
      this.#level = value;
    }
  }

  #type;
  /** @param {T} type */
  constructor(type){
    this.#type = type;
  }
  async log(...args){
    Logger.log(this.#type, ...args);
  }
  async error(...error){
    Logger.error(this.#type, ...error);
  }

  static async log(type, ...args) {
    const time = this.#getTime();
    this.#preInitQueue.push({ logType: this.Level.LOG, time, type, args });
  }

  static async error(type, ...args) {
    const time = this.#getTime();
    this.#preInitQueue.push({ logType: this.Level.ERROR, time, type, args });
  }

  /** @param {string} type */
  static #hasType(type) {
    if(this.#types.size === 0) {
      return true;
    }
    return this.#types.has(type);
  }

  static async #log(time, type, ...args) {
    if((this.#level & Logger.Level.LOG) === 0)
      return;
    if(!this.#hasType(type))
      return;
    const position = this.#getLineAddress();
    console.log(`(${ position })`, `[LOG] [${ type }]:`, ...args);
    await this.#saveFile(time, "LOG", type, args);
  }

  static async #error(time, type, ...errors){
    if((this.#level & Logger.Level.ERROR) === 0)
      return;
    if(!this.#hasType(type))
      return;
    const position = this.#getLineAddress();
    console.error(`(${ position })`, `[ERR] [${type}]:`, ...errors);
    await this.#saveFile(time, "ERR", type, errors);
  }

  /** @param {{ dirname?: string; testing?: boolean; logsDirectory?: string; level?: typeof Logger.Level[keyof typeof Logger.Level]; type?: string[] }} options  */
  static async init(options = {}) {
    if("dirname" in options) {
      this.dirname = options.dirname;
    }
    if("testing" in options) {
      this.testing = options.testing;
    }
    if("logsDirectory" in options) {
      this.logsDirectory = options.logsDirectory;
    }
    if("level" in options) {
      this.level = options.level;
    }
    if("type" in options) {
      this.#types = new Set(options.type);
    }
    try {
      const stats = await stat(this.#path);
      this.#initialse();
      return true;
    } catch(ex) {
      console.log(`Logger.init(): ${ ex.message }`);
      return false;
    }
  }

  static #initialse() {
    this.log = async function(type, ...args) {
      return this.#log(this.#getTime(), type, ...args);
    };
    this.error = async function(type, ...args) {
      return this.#error(this.#getTime(), type, ...args);
    };
    this.#processPreInitQueue();
  }

  static #processPreInitQueue() {
    for(const { logType, time, type, args } of this.#preInitQueue) {
      switch(logType) {
        case this.Level.NONE:
          this.#log(time, type, ...args);
        break;
        case this.Level.ERROR:
          this.#error(time, type, ...args);
      }
    }
  }

  /** Get context of log */
  static #getLineAddress(depth = 4) {
    const errorStack = (new Error).stack.split("\n");
    // const [ path, line, column ] = errorStack.at(-2).split(":");
    let linePath = errorStack.at(depth).split("at")[1].replace("file:///", "").trim();
    if(this.#dirname) {
      linePath = linePath.replace(this.#dirname, ".");
    }
    if(linePath.includes("(")) {
      linePath = linePath.substring(linePath.indexOf("(") + 1, linePath.indexOf(")"));
    }
    const [ path, line, column ] = linePath.split(":");
    return `${ path }:${ line }`;
  }

  static #getTime(replaceColon = false){
    const date = new Date();
    if(replaceColon) {
      return date.toISOString().replace(/:/g, "-");
    }
    return date.toISOString();
    const yyyy = date.getFullYear();
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    const time = date.toLocaleTimeString("en-IN", { hour12: false });
    return `${ yyyy }-${ mm }-${ dd } ${
      replaceColon ? time.replace(/:/g, "-") : time
    }`;
  }

  static #createFile(){
    try{
      writeFile(
        this.fileName,
        `${this.#fileName}\n`, { encoding: "utf-8" }
      );
    } catch(ex){
      console.log(ex);
    }
  }

  /**
   * @param {string} time
   * @param {"LOG" | "ERR"} logType
   * @param {string} subType
   * @param {any[]} data
  */
  static async #saveFile(time, logType, subType, data) {
    try {
      const args = data.map(arg => {
        switch(typeof arg) {
          case "object":
            try {
              return `<${ arg.constructor.name }> ${ JSON.stringify(arg) }`;
            } catch(_ex) {
              return `<${ arg.constructor.name }> ${ arg }`;
            }
          case "function":
            return `<${ arg.constructor.name }> ${ arg.name }`;
        }
        return arg;
      });
      await appendFile(
        this.fileName,
        `[${ time }] [${ logType }] [${ subType }]: ${ args.join(" ") }\n`
      );
    } catch(ex) {
      console.log(ex);
    }
  }
};