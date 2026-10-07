/** @type {<T, R>(object: T, scope: (this: T extends {} ? T : never, ref: T extends {} ? T : never) => R) => T extends {} ? R : void} */
export function using(object, scope) {
  if(object !== null && object instanceof Object) {
    return scope.call(object, object);
  }
}

/** @type {<T, F extends (...args: any[]) => any>(fn: F, thisArg: T, args: F extends (...args: infer A) => any ? A : never) => F extends (...args: any[]) => infer R ? R : never} */
export function fnApply(fn, thisArg, args) {
  return fn.apply(thisArg, args);
}

/** @type {<T, F extends (...args: any[]) => any, A extends any[]>(fn: F, thisArg: T, ...args: A) => F extends (...args: infer P) => infer R ? (this: T, ...args: P extends A ? never[] : P ) => R : F} */
export function fnBind(fn, thisArg, ...args) {
  return fn.bind(thisArg, ...args);
}

/** @type {<T extends Iterable<readonly [PropertyKey, any]>>(iterable: T) => T extends (readonly [infer K, infer V])[] ? { [k in K]: V } : never} */
export function fromEntries(iterable) {
  return Object.fromEntries(iterable);
};

export function elementsById(log = false){
  const obj = {};
  let str = "/** @type {{ ";
  document.querySelectorAll("[id]").forEach(element => {
    const templatesString = "getTemplates" in element.constructor ? `<${ element.constructor.getTemplates(element).join(", ") }>` : "";
    str += `"${ element.id }": ${ element.constructor.name }${ templatesString }; `;
    obj[element.id] = element;
  });
  if(str.includes(";")){
    str = str.substring(0, str.length - 2);
  }
  if(log){
    console.log(str + " }} */");
  }
  Object.freeze(obj);
  Object.seal(obj);
  Object.preventExtensions(obj);
  return obj;
}

class StringableText extends Text {
  constructor(data) {
    super(data);
  }
  [Symbol.toPrimitive]() {
    return this.data;
  }
};

/** @template {string} T */
export class VariableManager {

  /** @type {Map<T, Text[]>} */
  #variables = new Map();

  /** @type {Map<Text, { attr: Attr; representation: (string | StringableText)[] }[]>} */
  #attributes = new WeakMap();

  /** @param {Document} document */
  constructor(document, log = false) {
    const nodes = VariableManager.evaluateAnyType(document, "//*[contains(text(), \"{{\")]");
    const attributeNodes = VariableManager.evaluateAnyType(document, "//*[@*[contains(., \"{{\")]]");

    for(const node of nodes) {
      const textNodes = this.asTextContent(node.textContent);
      node.textContent = "";
      node.append(...textNodes);
    }

    for(const node of attributeNodes) {
      for(const attr of node.attributes) {
        this.asAttribute(attr);
      }
    }

    if(log) {
      console.log(`/** @type {${ new.target.name }<"${ Array.from(this.#variables.keys()).join("\" | \"") }">} */`);
    }
  }

  createIfNotExist(name) {
    if(!this.#variables.has(name)) {
      this.#variables.set(name, []);
    }
  }

  addTextContent(name) {
    const node = new Text(`{{${ name }}}`);
    this.createIfNotExist(name);
    this.#variables.get(name).push(node);
    return node;
  }

  /** @param {Attr} attr */
  addAttribute(name, attr, representation) {
    const node = new StringableText(`{{${ name }}}`);
    this.createIfNotExist(name);
    this.#variables.get(name).push(node);
    if(!this.#attributes.has(node)) {
      this.#attributes.set(node, []);
    }
    this.#attributes.get(node).push({ attr, representation });
    return node;
  }

  /**
   * @param {T} name
   * @param {string} value
   */
  set(name, value) {
    if(!this.#variables.has(name)) {
      return false;
    }
    for(const node of this.#variables.get(name)) {
      node.textContent = value;
      if(this.#attributes.has(node)) {
        for(const attribute of this.#attributes.get(node)) {
          attribute.attr.value = attribute.representation.join("");
        }
      }
    }
    return true;
  }

  /** @param {{ [K in T]: string }} variables */
  setMany(variables) {
    for(const name in variables) {
      this.set(name, variables[name]);
    }
  }

  /**
   * @template R
   * @param {string} text
   * @param {(variableName: string) => R} cb
  */
  static parse(text, cb) {
    return text.split("{{").flatMap((text, index) => {
      const [ variableName, ...restOfText ] = text.split("}}");
      if(restOfText.length === 0) {
        return (index === 0 ? "" : "{{") + text;
      }
      return [ cb(variableName.trim()), restOfText.join("}}") ];
    }).filter(text => text !== "");
  }

  /** @param {string} text */
  asTextContent(text) {
    return VariableManager.parse(text, variableName => this.addTextContent(variableName));
  }

  /** @param {Attr} attr */
  asAttribute(attr) {
    const representation = [];
    const contents = VariableManager.parse(attr.value, variableName => this.addAttribute(variableName, attr, representation));
    representation.push(...contents);
  }

  /** @param {Document} document */
  static evaluateAnyType(document, expression) {
    const nodeResult = document.evaluate(expression, document, null, XPathResult.ANY_TYPE, null);
    let node = nodeResult.iterateNext();
    const nodes = [];
    while(node !== null) {
      nodes.push(node);
      node = nodeResult.iterateNext();
    }
    return nodes;
  }

};

export class ConsoleLog {
  static property(property = {}) {
    const entry = Object.entries(property)[0];
    console.log(`%c%s: ${ entry[1] }`, "background-color: #fff; color: #444; padding: 0.25rem 0.5rem;", entry[0]);
  }
};

export class Conversions {

  static Data;

  static {

    this.Data = class Data {

      /**
       * @template {boolean} U
       * @param {number} bytes
       * @param {{ precision?: number; units?: U }} options
       * @returns {U extends true ? string : number}
       */
      static bytesToMB(bytes, options = {}) {
        const precision = options?.precision ?? 100;
        const quantity = Math.floor(bytes / 1024 / 1024 * precision) / precision;
        if(options?.units === true) {
          return quantity + " MB";
        }
        return quantity;
      }

      /**
       * @template {boolean} U
       * @param {number} bpms
       * @param {{ precision?: number; units?: U }} options
       * @returns {U extends true ? string : number}
       */
      static BpmsToMBps(bpms, options = {}) {
        const precision = options?.precision ?? 100;
        const quantity = Math.floor(bpms / 1024 / 1024 * 1000 * precision) / precision;
        if(options?.units === true) {
          return quantity + " MB/s";
        }
        return quantity;
      }

    };

  }

};

/**
 * @template {{ [key: boolean]: any }} M
 * @param {M} map
 * @returns {M[keyof M]}
 */
function AND(map, ...vars) {
  return map[vars.every(value => value)];
}

/**
 * @template {{ [key: boolean]: any }} M
 * @param {M} map
 * @returns {M[keyof M]}
 */
function OR(map, ...vars) {
  return map[vars.some(value => value)];
}

AND({ true: 10, false: 20 }, true, false)