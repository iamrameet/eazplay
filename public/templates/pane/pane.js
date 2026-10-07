/// <reference path="./pane.helper.d.ts"/>

const { panesTemplate, paneTemplate } = await eazuse(import.meta.resolve("./pane.html"));

export class PaneChangeEvent extends Event {
  /**
   * @param {"beforepanechange"} type
   * @param {Pane} previousPane
   * @param {Pane} currentPane
   * @param {EventInit} [eventInitDict]
  */
  constructor(type, previousPane, currentPane, eventInitDict) {
    super(type, eventInitDict);
    this.previousPane = previousPane;
    this.currentPane = currentPane;
  }
};

/** @template {string} [T=string] */
export class PanesManager extends HTMLElement {

  #shadowRoot;
  /** @type {Pane | null} */
  #selectedPane = null;
  /** @type {Map<T, Set<PaneNavigator>>} */
  #navigators = new Map();
  /** @type {T[]} */
  #selectionHistory = [];
  #selectionIndex = 0;

  constructor() {
    super();
    this.#shadowRoot = this.attachShadow({ mode: "open" });
    this.#shadowRoot.appendChild(panesTemplate.content.cloneNode(true));

    this.#shadowRoot.querySelector("slot").addEventListener("slotchange", function() {
      for(const node of this.assignedNodes()) {
        if(node instanceof Pane) {
          continue;
        }
        node.parentNode.removeChild(node);
      }
    });
  }

  /** @returns {T | undefined} */
  get selectedPaneName() {
    return this.#selectedPane?.name;
  }

  get selectedPaneNavigators() {
    const set = new Set(this.#navigators.get(this.selectedPaneName) ?? []);
    return Object.freeze(set);
  }

  /**
   * @template {T} K
   * @param {K} name
   * @returns {Pane | null}
   */
  getPane(name) {
    return this.children.namedItem(name);
  }

  /** @param {T} name */
  selectPane(name) {
    this.#selectPane(name, true);
  }

  /**
   * @param {T} name
   * @param {boolean} addToHistory 
   */
  #selectPane(name, addToHistory) {
    const pane = this.getPane(name);
    if(pane === null || pane instanceof Pane === false) {
      throw `'${ pane }' is not a typeof '${ Pane.name }'`;
    }
    if(this.#selectedPane === pane) {
      return;
    }
    let changeEvent = new PaneChangeEvent("beforepanechange", this.#selectedPane, pane, { cancelable: true });
    const defaultPrevented = this.dispatchEvent(changeEvent);
    if(!defaultPrevented) {
      return;
    }
    if(this.#selectedPane !== null) {
      this.#selectedPane.active = false;
    }
    pane.active = true;
    const previousPane = this.#selectedPane;
    this.#selectedPane = pane;
    if(addToHistory && previousPane) {
      this.#selectionHistory.push(previousPane.name);
    }
    changeEvent = new PaneChangeEvent("panechange", previousPane, this.#selectedPane);
    this.dispatchEvent(changeEvent);
  }

  goBack() {
    if(this.#selectionHistory.length === 0) {
      return;
    }
    const name = this.#selectionHistory.pop();
    this.#selectPane(name, false);
  }

  /** @param {PaneNavigator} navigator */
  addPaneNavigator(navigator) {
    if(navigator instanceof PaneNavigator === false) {
      throw new TypeError(`'${ navigator } is not a typeof '${ PaneNavigator.name }`);
    }
    const { paneName } = navigator;
    if(!this.#navigators.has(paneName)) {
      this.#navigators.set(paneName, new Set());
    }
    this.#navigators.get(navigator.paneName).add(navigator);
  }

  /** @param {PaneNavigator} navigator */
  removePaneNavigator(navigator) {
    if(navigator instanceof PaneNavigator === false) {
      throw new TypeError(`'${ navigator } is not a typeof '${ PaneNavigator.name }`);
    }
    return this.#navigators.get(navigator.paneName)?.delete(navigator) ?? false;
  }

  *panes() {
    for(const element of this.children) {
      if(element instanceof Pane) {
        yield element;
      }
    }
  }

  /** @param {T} name */
  *paneNavigators(name) {
    if(!this.#navigators.has(name)) {
      return;
    }
    for(const navigator of this.#navigators.get(name)) {
      yield navigator;
    }
  }

  connectedCallback() {}

  /** Only for util
   * @param {PanesManager} instance */
  static getTemplates(instance) {
    return [ [...instance.panes()].map(pane => `"${ pane.name }"`).join(" | ") ];
  }

};

export class Pane extends HTMLElement {

  #shadowRoot;

  constructor() {
    super();
    this.#shadowRoot = this.attachShadow({ mode: "open" });
    this.#shadowRoot.appendChild(paneTemplate.content.cloneNode(true));
    if(this.active && this.parentElement instanceof PanesManager) {
      this.parentElement.selectPane(this.getAttribute("name"));
    }
  }

  get name() {
    return this.getAttribute("name");
  }

  get active() {
    return this.hasAttribute("active");
  }

  set active(value) {
    this.toggleAttribute("active", value);
  }

  connectedCallback() {}

  attributeChangeCallback(name, oldValue, newValue) {
    console.log(name, oldValue, newValue);
  }

};

/** @extends {HTMLButtonElement} */
export class PaneNavigator extends HTMLButtonElement {

  /** @param {{ type?: HTMLButtonElement["type"]; className?: string; paneParent?: string | PanesManager; pane?: string | Pane; navigation?: "back"; children?: Node[] }} [options] */
  constructor(options) {
    super();
    if(typeof options === "object") {
      this.type = options.type ?? "button";
      this.className = options.className ?? "";
      if("paneParent" in options) {
        this.paneParent = options.paneParent;
      }
      if("navigation" in options) {
        this.navigation = options.navigation;
      }
      if("pane" in options) {
        this.paneName = options.pane instanceof Pane ? options.pane.id : options.pane;
      }
      if("children" in options) {
        this.append(...options.children);
      }
    }
    this.addEventListener("click", () => {
      const { paneParent, navigation } = this;
      if(navigation) {
        return void paneParent.goBack();
      }
      if(paneParent) {
        paneParent.selectPane(this.paneName);
      }
    });
  }

  connectedCallback() {
    const { paneParent } = this;
    if(paneParent !== null) {
      paneParent.addPaneNavigator(this);
    }
  }

  disconnectedCallback() {
    const { paneParent } = this;
    if(paneParent !== null) {
      paneParent.removePaneNavigator(this);
    }
  }

  /** @returns {"back" | undefined} */
  get navigation() {
    return this.getAttribute("navigation");
  }

  /** @returns {PanesManager | null} */
  get paneParent() {
    return document.getElementById(this.getAttribute("pane-parent"));
  }

  get paneName() {
    return this.getAttribute("pane") ?? "";
  }

  /** @param {"back"} direction */
  set navigation(direction) {
    return this.setAttribute("navigation", direction);
  }

  /** @param {string | PanesManager} id */
  set paneParent(id) {
    if(id instanceof PanesManager) {
      id = id.id;
    }
    this.setAttribute("pane-parent", id);
  }

  set paneName(name) {
    this.setAttribute("pane", name);
  }

};