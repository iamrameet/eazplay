import CachedFetch from "./cached-fetch.js";
import CachedMap from "./cached-map.js";

globalThis.cachedAPI = new CachedFetch(20);

async function fetchDocument(path) {
  const response = await cachedAPI.fetch(path, { method: "GET" });
  const text = await response.text();
  const parser = new DOMParser();
  return parser.parseFromString(text, "text/html");
}

/** @returns {Promise<{ [id: string]: HTMLTemplateElement }>} */
globalThis._eazuse = async function eazuse(path) {

  const document = await fetchDocument(path);
  const templates = document.head.getElementsByTagName("template");
  const scripts = document.head.getElementsByTagName("script");

  const templatesById = Object.fromEntries(Array.from(templates).map(template => {
    const { id } = template;
    // template.id = "";
    return [ id, template ];
  }));

  window.document.head.append(...templates);

  for(const script of scripts) {
    const newScriptTag = document.createElement("script");
    newScriptTag.type = script.type;
    if(script.src === "") {
      newScriptTag.textContent = script.textContent;
    } else {
      let src = script.getAttribute("src");
      if(!(src.startsWith("http://") || src.startsWith("https://") || src[0] === "/" || src[0] === "\\")) {
        const url = new URL(path, window.location.origin);
        const parts = url.href.split("/");
        parts.pop();
        src = parts.join("/") + "/" + src;
      }
      newScriptTag.src = src;
    }
    window.document.head.appendChild(newScriptTag);
  }

  return templatesById;

}

/** @type {CachedMap<string, { [id: string]: HTMLTemplateElement }>} */
globalThis.templatesMap = new CachedMap(10);

/** @returns {Promise<{ [id: string]: HTMLTemplateElement }>} */
globalThis.eazuse = async function eazuse(path) {

  const pathBase = getPathBase(path);

  if(templatesMap.has(path)) {
    return templatesMap.get(path);
  }

  const document = await fetchDocument(path);
  const templates = document.head.getElementsByTagName("template");
  const scripts = document.head.getElementsByTagName("script");

  const templatesById = Object.fromEntries(Array.from(templates).map((template, index) => {
    let { id } = template;
    if(id === "") {
      id = "template" + index;
      console.info(`eazuse: An auto generated id '${ id }' is provided because id attribute found.`);
    }
    resolveElementAddress(pathBase, template.content, "href");
    resolveElementAddress(pathBase, template.content, "src");
    return [ id, template ];
  }));

  window.document.head.append(...templates);

  for(const script of scripts) {
    const newScriptTag = document.createElement("script");
    newScriptTag.type = script.type;
    if(script.src === "") {
      newScriptTag.textContent = script.textContent;
    } else {
      let src = script.getAttribute("src");
      if(!(src.startsWith("http://") || src.startsWith("https://") || src[0] === "/" || src[0] === "\\")) {
        const url = new URL(path, window.location.origin);
        const parts = url.href.split("/");
        parts.pop();
        src = parts.join("/") + "/" + src;
      }
      newScriptTag.src = src;
    }
    window.document.head.appendChild(newScriptTag);
  }

  templatesMap.set(path, templatesById);
  return templatesById;

};

/**
 * @param {string} base
 * @param {DocumentFragment} fragment
 * @param {"href" | "src"} attribute
*/
function resolveElementAddress(base, fragment, attribute) {
  const links = fragment.querySelectorAll(`[${ attribute }]`);
  for(const element of links) {
    const link = element.getAttribute(attribute);
    element.setAttribute(attribute, resolvePath(link, base));
  }
}

/**
 * @param {string} path
 * @param {string} base
*/
function resolvePath(path, base) {
  if(path.startsWith("http://") || path.startsWith("https://") || path.startsWith("file://")) {
    return path;
  }
  if(path[0] === "/" || path[0] === "\\") {
    return path.substring(1);
  }
  return base + path;
}

/** @param {string} path */
function getPathBase(path) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") + "/";
}