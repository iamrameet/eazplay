import ElementsBuilder from "../../modules/elements-builder.js";

const { alertPanelTemplate } = await eazuse(import.meta.resolve("./alert-panel.html"));

const { button: Button, div: Div } = ElementsBuilder.multiple("div", "button");

/** @typedef {{ timeout?: number; type?: typeof AlertPanel.Popup.INFO | typeof AlertPanel.Popup.SUCCESS | typeof AlertPanel.Popup.ERROR }} PopupOptions */

/** @extends {HTMLElement} */
export default class AlertPanel extends HTMLElement {

  static Popup;

  /** @type {Set<InstanceType<typeof AlertPanel.Popup>>} */
  #popups = new Set();
  #shadowRoot;

  constructor() {
    super();
    this.#shadowRoot = this.attachShadow({ mode: "closed" });
    this.#shadowRoot.append(alertPanelTemplate.content.cloneNode(true));

    /** @type {HTMLButtonElement} */
    const clearAllButton = this.#shadowRoot.getElementById("clear-all-button");

    clearAllButton.addEventListener("click", async () => {
      clearAllButton.disabled = true;
      let index = 0;
      for(const popup of this.#popups) {
        setTimeout(() => popup.hide(), 100 * (this.#popups.size - index));
        index++;
      }
      clearAllButton.disabled = false;
    });

    this.classList.add("empty");

  }

  /**
   * @param {string} message
   * @param {PopupOptions} [options]
  */
  popup(message, options) {
    return new AlertPanel.Popup(this, message, options);
  }

  /**
   * @param {string} message
   * @param {Omit<PopupOptions, "type">} [options]
   */
  success(message, options = {}) {
    return this.popup(message, { ...options, type: AlertPanel.Popup.SUCCESS });
  }

  /** @type {AlertPanel["success"]} */
  info(message, options = {}) {
    return this.popup(message, { ...options, type: AlertPanel.Popup.INFO });
  }

  /** @type {AlertPanel["success"]} */
  error(message, options = {}) {
    return this.popup(message, { ...options, type: AlertPanel.Popup.ERROR });
  }

  #markEmpty() {
    if(this.#popups.size === 0) {
      this.classList.add("empty");
    }
  }

  #unmarkEmpty() {
    this.classList.remove("empty");
  }

  static {

    this.Popup = class Popup {

      /**
       * @enum
       * @readonly */
      static INFO = 0;
      /**
       * @enum
       * @readonly */
      static SUCCESS = 1;
      /**
       * @enum
       * @readonly */
      static ERROR = 2;

      #panel;

      #element;
      #timeout;
      #timeoutId;
      #visibilityTimeoutId;
      // Time at which modal is shown
      #timestamp = Date.now();

      /**
       * @param {AlertPanel} panel
       * @param {string} message
       * @param {PopupOptions} options
       */
      constructor(panel, message, options = {}) {
        if(panel instanceof AlertPanel === false) {
          throw new TypeError(`Popup's first argument must an instance of ${ AlertPanel.name }`);
        }
        this.#panel = panel;
        this.#timeout = options.timeout ?? 3000;
        this.#element = new Div({
          className: `popup-container type-${ options.type ?? Popup.INFO }`,
          $listeners: {
            mouseenter: () => this.#mouseEnter(),
            mouseleave: () => this.#mouseLeave()
          },
          append: [
            Popup.#createContentElement(message),
            Popup.#createCloseButton(() => this.hide())
          ]
        });

        window.addEventListener("blur", () => this.#mouseLeave());
        this.show();

      }

      get hidden() {
        return this.#element.parentElement === null;
      }

      show() {
        this.#element.classList.add("visible");
        this.#panel.#shadowRoot.appendChild(this.#element);
        this.#panel.#popups.add(this);
        this.#panel.#unmarkEmpty();
        clearTimeout(this.#visibilityTimeoutId);
        this.#visibilityTimeoutId = setTimeout(() => this.#autoHide(), 300);
      }

      hide() {
        this.#element.classList.remove("visible");
        clearTimeout(this.#visibilityTimeoutId);
        this.#visibilityTimeoutId = setTimeout(() => {
          this.#element.remove();
          this.#panel.#popups.delete(this);
          this.#cancelAutoHide();
          this.#panel.#markEmpty();
        }, 300);
      }

      #autoHide() {
        this.#timestamp = Date.now();
        clearTimeout(this.#timeoutId);
        if(this.#timeout !== Infinity) {
          this.#timeoutId = setTimeout(() => this.hide(), this.#timeout);
        }
      }

      #cancelAutoHide() {
        clearTimeout(this.#timeoutId);
      }

      #mouseEnter() {
        if(this.#timeout !== Infinity) {
          const delta = Date.now() - this.#timestamp;
          this.#timeout -= delta;
        }
        this.#cancelAutoHide();
      }

      #mouseLeave() {
        this.#autoHide();
      }

      /** @param {string} content */
      static #createContentElement(content) {
        return new Div({
          className: "content",
          innerHTML: content
        });
      }

      /** @param {(this: HTMLButtonElement, ev: MouseEvent) => void} onclick */
      static #createCloseButton(onclick) {
        const button = new Button({
          type: "button",
          className: "close",
          $listeners: { click: onclick }
        });

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttributeNS(null, "viewBox", "0 0 256 256");

        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttributeNS("http://www.w3.org/1999/xlink", "href", "assets/icons/regular.svg#close");

        svg.appendChild(use);
        button.appendChild(svg);

        return button;
      }

    };

  }

};