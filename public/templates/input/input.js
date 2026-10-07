import ElementsBuilder from "../../modules/elements-builder.js";
import { fnBind, using } from "../../modules/util.js";

const { checkboxTemplate, segmentedInputTemplate, inputBoxTemplate, radioTemplate, selectTemplate } = await eazuse(import.meta.resolve("./input.html"));

const Input = ElementsBuilder.single("input");

export class UICheckable extends HTMLElement {

  #input;

  /**
   * @param {"radio" | "checkbox"} inputType
   * @param {DocumentFragment} fragment
   * @param {(privateMembers: { input: HTMLInputElement }) => void} inputCallback
  */
  constructor(inputType, fragment, inputCallback) {
    super();

    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(fragment.cloneNode(true));

    this.#input = new Input({
      type: inputType,
      hidden: true,
      $attributes: {
        name: this.getAttribute("name"),
        value: this.getAttribute("value") ?? "on"
      },
      addEventListener: [ "change", () => this.dispatchEvent(new Event("input-change")) ]
    });

    this.appendChild(this.#input);
    inputCallback?.({ input: this.#input });

    this.addEventListener("click", () => {
      this.#input.click();
      this.toggleAttribute("checked", this.#input.checked);
    });

    const box = shadowRoot.getElementById("box");
    box.tabIndex = 0;
    box.addEventListener("keyup", event => {
      switch(event.code) {
        case "Space":
        case "Enter":
          this.click();
      }
    });

  }

  get checked() {
    return this.hasAttribute("checked");
  }

  set checked(value) {
    this.#input.checked = value;
    return this.toggleAttribute("checked", value);
  }

  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(value) {
    this.#input.disabled = value;
    return this.toggleAttribute("disabled", value);
  }

};

export class UICheckbox extends UICheckable {

  constructor() {
    /** @type {DocumentFragment} */
    const fragment = checkboxTemplate.content;
    super("checkbox", fragment);
  }

};

export class UIRadio extends UICheckable {

  /** @type {NodeListOf<UIRadio>} */
  #radioInputList;

  constructor() {
    /** @type {DocumentFragment} */
    const fragment = radioTemplate.content;
    super("radio", fragment);
    const name = this.getAttribute("name");
    this.#radioInputList = this.ownerDocument.querySelectorAll(`${ this.tagName }[name=${ name }]`);
    this.addEventListener("input-change", () => {
      for(const radioInput of this.#radioInputList) {
        if(radioInput === this) {
          continue;
        }
        radioInput.checked = false;
      }
    });
  }

};

export class InputBox extends HTMLElement {

  static formAssociated = true;
  /** @type {(Exclude<keyof HTMLInputElement, keyof HTMLElement> | "submit-delay")[]} */
  static #observedAttributes = [...Object.keys(HTMLInputElement.prototype), "submit-delay"];

  /** @type {HTMLInputElement} */
  #input;
  /** @type {HTMLOutputElement} */
  #output;
  #shadowRoot;
  #internals;
  /** @type {Readonly<Set<string>>} */
  #selectedPaths = new Set;
  #submitConfig;

  constructor() {
    super();
    /** @type {DocumentFragment} */
    const fragment = inputBoxTemplate.content;
    this.#shadowRoot = this.attachShadow({ mode: "closed" });
    this.#internals = this.attachInternals();
    this.#shadowRoot.appendChild(fragment.cloneNode(true));
    this.#input = this.#shadowRoot.getElementById("input");

    this.#internals.setFormValue(this.#input.value);
    this.#submitConfig = {
      timeoutId: undefined,
      submitDelay: -1,
      keyupHandler: fnBind(this.#requestFormSubmit, this)
    };

    this.#output = this.#shadowRoot.getElementById("output");
    this.#output.value = this.placeholder ?? "Choose file(s)";

    this.addEventListener("click", this.#textClickHandler);

    this.#input.addEventListener("input", () => {
      const formData = new FormData;
      const name = this.getAttribute("name");
      if(this.#input.type === "file") {
        for(const file of this.#input.files) {
          formData.append(name, file);
        }
      } else {
        formData.append(name, this.#input.value);
      }
      this.#internals.setFormValue(formData);
    });

  }

  static get observedAttributes() {
    return this.#observedAttributes;
  }

  get placeholder() {
    return this.getAttribute("placeholder") ?? "";
  }

  /** @returns {"file" | "directory"} */
  get kind() {
    return this.getAttribute("kind") ?? "file";
  }

  get filepaths() {
    return this.#selectedPaths;
  }

  get rightIconElement() {
    return this.#shadowRoot.getElementById("iconHolderRight").children[0] ?? null;
  }

  get submitDelay() {
    return Number.parseInt(this.getAttribute("submit-delay") ?? "0");
  }
  set submitDelay(value) {
    this.setAttribute("submit-delay", value);
  }

  get value() {
    return this.#input.value;
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  get disabled() {
    return this.#input.disabled;
  }
  set disabled(value) {
    this.toggleAttribute("disabled", value);
  }

  get form() {
    return this.#internals.form;
  }

  /**
   * @param {typeof InputBox.observedAttributes[number]} name
   * @param {string} oldValue
   * @param {string} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if(newValue === null) {
      this.#input.removeAttribute(name);
      return;
    }
    switch(name) {
      case "type":
        if(oldValue === "file") {
          this.#destroyFileChooser();
        }
        if(newValue === "file") {
          this.#initFileChooser();
        }
        this.#input.setAttribute(name, newValue);
      break;
      case "submit-delay": {
        const delay = Number.parseInt(newValue);
        clearTimeout(this.#submitConfig.timeoutId);
        if(Number.isInteger(delay) && delay >= 0) {
          this.#submitConfig.submitDelay = delay;
          this.#input.addEventListener("keyup", this.#submitConfig.keyupHandler);
        } else {
          this.#submitConfig.submitDelay = -1;
          this.#input.removeEventListener("keyup", this.#submitConfig.keyupHandler);
        }
      }
      break;
      default:
        this.#input.setAttribute(name, newValue);
    }
  }

  #requestFormSubmit() {
    clearTimeout(this.#submitConfig.timeoutId);
    this.#submitConfig.timeoutId = setTimeout(() => this.form?.requestSubmit(), this.#submitConfig.submitDelay);
  }

  /**
   * @template {keyof HTMLElementEventMap | "change"} T
   * @param {T} eventType
   * @param {(this: InputBox, event: T extends "change" ? CustomEvent : HTMLElementEventMap[T]) => void} listener
   * @param {boolean | AddEventListenerOptions} [options]
   */
  addEventListener(eventType, listener, options) {
    super.addEventListener(eventType, listener, options);
  }

  /** @type {HTMLInputElement["focus"]} */
  focus(...args) {
    this.#input.focus(...args);
  }

  /** @param {MouseEvent} event */
  async #fileChooserClickHandler(event) {
    event.preventDefault();
    const { canceled, filePaths } = await electronAPI.invoke("dialog:openFile", {
      filters: this.#input.accept.split(",")
        .map(type => ({ extensions: type.split("/")[1]?.trim() }))
        .filter(filter => filter.extensions),
      kind: this.kind,
      multiple: this.#input.multiple
    });
    // for(const filepath of filePaths) {
    //   if(!this.#selectedPaths.has(filepath)) {}
    // }
    if(canceled) {
      return;
    }
    this.#selectedPaths = Object.freeze(new Set(filePaths));
    this.#output.value = this.#fileHandler(filePaths);
    this.dispatchEvent(new CustomEvent("change"));
  }

  #textClickHandler(event) {
    this.#input.focus();
  }

  /** @param {MouseEvent} event */
  #fileChooserKeyupHandler(event) {
    switch(event.code) {
      case "Space":
      case "Enter":
        this.click();
    }
  }

  #initFileChooser() {
    this.tabIndex = 0;
    this.removeEventListener("click", this.#textClickHandler);
    this.addEventListener("click", this.#fileChooserClickHandler);
    this.addEventListener("keyup", this.#fileChooserKeyupHandler);
  }

  #destroyFileChooser() {
    this.removeEventListener("click", this.#fileChooserClickHandler);
    this.removeEventListener("keyup", this.#fileChooserKeyupHandler);
    this.addEventListener("click", this.#textClickHandler);
  }

  /** @type {(filepaths: string[]) => void} */
  #fileHandler(filepaths) {
    const filesCount = filepaths.length
    switch(filesCount) {
      case 0:
        return this.placeholder ?? "Choose file(s)";
      case 1:
        return filepaths[0];
      default:
        return `${ filesCount } items selected`
    }
  }

};

export class SegmentedInput extends HTMLElement {

  #input = document.createElement("input");
  /** @type {HTMLInputElement[]} */
  #inputs = [];
  /** @type {ShadowRoot} */
  #shadowRoot;

  /**
   * @param {number} segments
   * @param {"text" | "number"} [type]
  */
  constructor(segments, type) {
    super();
    /** @type {DocumentFragment} */
    const fragment = segmentedInputTemplate.content;
    this.#shadowRoot = this.attachShadow({ mode: "closed" });
    this.#shadowRoot.appendChild(fragment.cloneNode(true));

    segments = segments ?? this.segments;
    type = type ?? this.getAttribute("type") ?? "text";

    const value = (this.getAttribute("value") ?? "").slice(0, segments);
    this.setAttribute("value", value);
    const placeholder = (this.getAttribute("placeholder") ?? "").slice(0, segments);
    this.setAttribute("placeholder", placeholder);

    this.#input.type = type;
    this.#input.maxLength = segments;
    this.#input.name = this.getAttribute("name") ?? "";
    this.#input.value = value;
    this.#input.placeholder = placeholder;
    this.appendChild(this.#input);

    for(let index = 0; index < segments; index++) {
      const input = document.createElement("input");
      input.type = type;
      input.maxLength = 1;
      input.value = value[index] ?? "";
      input.placeholder = placeholder[index] ?? "";
      this.#inputs.push(input);
      this.#shadowRoot.appendChild(input);

      // input.addEventListener("focus", () => {
      //   input.selectionStart = 0;
      //   input.selectionEnd = 1;
      // });

      input.addEventListener("input", () => {
        if(input.value !== "") {
          this.#inputs[index + 1]?.focus();
        }
      });

      input.addEventListener("change", () => {
        const value = Array.from(this.#input.value);
        value[index] = input.value;
        this.#input.value = value.join("");
      });

      input.addEventListener("keyup", event => {
        switch(event.key) {
          case "Backspace":
            if(input.value === "") {
              this.#inputs[index - 1]?.focus();
            }
          break;
        }
      });

    }
  }

  get name() {
    return this.#input.name;
  }
  get type() {
    return this.#input.type;
  }

  get segments() {
    const segments = Number.parseInt(this.getAttribute("segments"));
    if(Number.isNaN(segments) || segments <= 0 || segments === Infinity) {
      return 0;
    }
    return segments;
  }

  get value() {
    return this.#input.value;
  }

};

export class UISelect extends HTMLElement {

  #value;

  constructor() {
    super();

    this.tabIndex = 0;

    const shadowRoot = this.attachShadow({ mode: "closed" })
    shadowRoot.appendChild(selectTemplate.content.cloneNode(true));

    const label = shadowRoot.getElementById("label");
    label.textContent = this.placeholder;

    /** @type {HTMLSlotElement} */
    const itemsSlot = shadowRoot.getElementById("itemsSlot");
    itemsSlot.addEventListener("slotchange", function(event) {
      for(const element of this.assignedElements()) {
        if(element instanceof HTMLOptionElement) {
          element.tabIndex = 0;
        }
      }
    });

    this.addEventListener("click", event => {
      const option = this.#handleEventForOptionElement(event);
      if(option) {
        label.textContent = option.text;
        this.#value = option.value;
        option.blur();
      }
    });

    this.addEventListener("keyup", event => {
      switch(event.code) {
        case "Space":
        case "Enter":
          const option = this.#handleEventForOptionElement(event) ?? this;
          option.click();
        break;
        case "ArrowDown":
          this.ownerDocument.activeElement?.nextElementSibling?.focus();
        break;
        case "ArrowUp":
          this.ownerDocument.activeElement?.previousElementSibling?.focus();
      }
    });
  }

  get value() {
    return this.#value;
  }

  get placeholder() {
    return this.getAttribute("placeholder") ?? "Select";
  }

  set placeholder(value) {
    this.setAttribute("placeholder");
  }

  /** @param {Event} event */
  #handleEventForOptionElement(event) {
    if(event.target instanceof HTMLElement) {
      const option = event.target.closest("option");
      if(option !== null) {
        return option;
      }
    }
    return null;
  }

};