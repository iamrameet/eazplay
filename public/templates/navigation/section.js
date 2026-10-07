import { Router } from "../../modules/routing.js";

const { sectionTemplate } = await eazuse(import.meta.resolve("./section.html"));

export default class NavigationSection extends HTMLElement {

  /** @type {HTMLSlotElement} */
  #titleSlot;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const fragment = sectionTemplate.content;
    this.shadowRoot.appendChild(fragment.cloneNode(true));
    const header = this.shadowRoot.getElementById("header");
    if(this.getAttribute("header") === "off") {
      header.style.display = "none";
    }
    this.#titleSlot = this.shadowRoot.getElementById("titleSlot");

    this.#titleSlot.addEventListener("slotchange", function() {
      const [ node, ...restNodes ] = this.assignedNodes();
      if(node === undefined) {
        return;
      }
      if(node.nodeType === Node.ELEMENT_NODE) {
        node.textContent = node.textContent;
      }
      for(const node of restNodes) {
        node.parentNode.removeChild(node);
      }
    });

  }

  get headerTitle() {
    const [ element ] = this.#titleSlot.assignedElements();
    return element?.textContent ?? "";
  }

  set headerTitle(value) {
    const [ element ] = this.#titleSlot.assignedElements();
    if(element) {
      element.textContent = value;
    }
  }

  connectedCallback() {
  }

};

export class NavButton extends HTMLButtonElement {

  static #navigationPresets = Object.freeze({
    backward: -1,
    forward: 1,
    index: 0,
    undefined: undefined
  });

  /**
   * Router must be set manualy
   * @type {Router | null} */
  static router = null;

  constructor() {
    super();
    this.addEventListener("click", () => {
      const navKey = this.navKey;
      if(navKey in NavButton.#navigationPresets) {
        const navValue = NavButton.#navigationPresets[navKey];
        return void NavButton.router?.goto(navValue);
      }
      const navPath = this.navPath;
      if(navPath) {
        NavButton.router?.goto(navPath);
      }
    });
  }

  static get navigationPresets() {
    return this.#navigationPresets;
  }

  /** @type {keyof NavButton.navigationPresets} */
  get navKey() {
    return this.getAttribute("nav-key");
  }

  set navKey(value) {
    this.setAttribute("nav-key", value);
  }

  get navPath() {
    return this.getAttribute("nav-path");
  }

  set navPath(value) {
    return this.setAttribute("nav-path", value);
  }
};