import ElementsBuilder from "../../modules/elements-builder.js";

const SvgElement = ElementsBuilder.singleNS("http://www.w3.org/2000/svg", "svg");
const UseElement = ElementsBuilder.singleNS("http://www.w3.org/2000/svg", "use");

export default class SVGIcon extends HTMLElement {

  static #defaultViewBox = "0 0 18 18";
  static get observedAttributes() {
    return /** @type {const} */ ([ "href", "viewbox" ]);
  }

  #svg;
  #use;

  /**
   * @param {string} href
   * @param {string} viewBox
   */
  constructor(href, viewBox = SVGIcon.#defaultViewBox) {
    super();
    console.log(viewBox)
    this.classList.add("icon");
    this.#use = new UseElement({
      $attributes: { href }
    });
    this.#svg = new SvgElement({
      $attributes: { viewBox },
      appendChild: this.#use
    });
    this.appendChild(this.#svg);
  }

  get href() {
    return this.#use.getAttribute("href");
  }

  set href(value) {
    this.#use.setAttribute("href", value);
  }

  get viewBox() {
    return this.#svg.getAttribute("viewBox");
  }

  set viewBox(value) {
    this.#svg.setAttribute("viewBox", value);
  }

  /**
   * @param {typeof SVGIcon.observedAttributes[number]} name
   * @param {string} oldValue
   * @param {string} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    switch(name) {
      case "viewbox":
        this.viewBox = newValue;
      break;
      case "href":
        this.href = newValue;
    }
  }

  /** @param {{ minX?: number; minY?: number; width?: number; height?: number }} dimensions */
  static setDefaultViewBox(dimensions) {
    this.#defaultViewBox = `${ dimensions?.minX ?? 0 } ${ dimensions?.minY ?? 0 } ${ dimensions?.width ?? dimensions?.height ?? 20 } ${ dimensions?.height ?? dimensions?.width ?? 20 }`;
  }

};