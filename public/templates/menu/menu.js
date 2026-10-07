export default class Menu extends HTMLMenuElement {

  constructor() {
    super();

    this.popover = "auto";

    this.addEventListener("click", function() {
      this.hidePopover();
    });

    /** @type {Map<string, import("../pane/pane").PaneNavigator>} */
    const kbdMap = new Map();

    /** @param {KeyboardEvent} event */
    const keyupHandler = event => {
      if(kbdMap.has(event.key)) {
        kbdMap.get(event.key).click();
        kbdMap.clear();
        this.removeEventListener("keyup", keyupHandler);
      }
    };

    this.addEventListener("toggle", () => {
      const isOpen = this.matches(":popover-open");
      if(isOpen) {
        const kbdElements = this.querySelectorAll("kbd");
        for(const kbd of kbdElements) {
          console.log(kbd.textContent.toLowerCase(), kbd.parentElement)
          kbdMap.set(kbd.textContent.toLowerCase(), kbd.parentElement);
        }
        this.getRootNode().addEventListener("keyup", keyupHandler);
      } else {
        kbdMap.clear();
        this.getRootNode().removeEventListener("keyup", keyupHandler);
      }
    });

    const mutationObserver = new MutationObserver(function(records) {
      for(const record of records) {
        switch(record.type) {
          case "childList":
            for(const node of record.addedNodes) {
              if(node instanceof HTMLLIElement) {
                node.tabIndex = 1;
              }
            }
        }
      }
    });

    mutationObserver.observe(this, { childList: true, subtree: true });

  }

  /** @param {MouseEvent} event */
  static #clickEventHandler(event) {
    if(event.composedPath().includes(this)) {
      console.log("found");
    } else {
      this.hide();
    }
  }

  getItems() {
    return Object.fromEntries(Array.from(this.getElementsByTagName("li")).map(element => [element.id, element]));
  }

  /** @param {HTMLLIElement} item */
  addItem(item, group = 0) {
    const rules = this.querySelectorAll("hr");
    group = Math.min(Math.max(0, group), rules.length - 1);
    rules.item(group).after(item);
  }

};