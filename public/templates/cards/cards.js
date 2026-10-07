const { cardsTemplate, cardTemplate } = await eazuse(import.meta.resolve("./cards.html"));

export class CardsArea extends HTMLElement {

  constructor() {
    super();
    const fragment = cardsTemplate.content;
    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(fragment.cloneNode(true));
    const cardsHolder = shadowRoot.getElementById("cards-holder");
    const scrollingArea = shadowRoot.getElementById("scrolling-area");
    /** @type {HTMLButtonElement} */
    const forwardButton = shadowRoot.getElementById("forward-button");
    /** @type {HTMLButtonElement} */
    const backwardButton = shadowRoot.getElementById("backward-button");

    scrollingArea.addEventListener("scroll", function() {
      const width = this.scrollWidth - this.clientWidth;
      const canScrollLeft = this.scrollLeft > 4;
      const canScrollRight = this.scrollLeft < width - 4;
      cardsHolder.classList.toggle("scrolled-left", canScrollLeft);
      cardsHolder.classList.toggle("scrolled-right", canScrollRight);
      backwardButton.disabled = !canScrollLeft;
      forwardButton.disabled = !canScrollRight;
    });

    backwardButton.addEventListener("click", () =>  this.#handleScrollNavigation(scrollingArea, -1));

    forwardButton.addEventListener("click", () => this.#handleScrollNavigation(scrollingArea, 1));

  }

  connectedCallback() {
    return;
    const cardsHolder = this.shadowRoot.getElementById("cards-holder");
    const scrollingArea = this.shadowRoot.getElementById("scrolling-area");
    const width = cardsHolder.scrollWidth - cardsHolder.clientWidth;
    cardsHolder.classList.toggle("scrolled-right", scrollingArea.scrollLeft < width - 4);
    console.log(this.parentElement)
  }

  /**
   * @param {HTMLDivElement} scrollingArea
   * @param {number} direction
   * */
  #handleScrollNavigation(scrollingArea, direction) {
    scrollingArea.scrollTo({
      left: scrollingArea.scrollLeft + scrollingArea.scrollWidth * direction,
      behavior: "smooth"
    });
    // const cards = this.getElementsByTagName("card-element");
    // const scrollWidth = scrollingArea.scrollWidth - scrollingArea.clientWidth;
    // if(scrollWidth === 0) {
    //   return;
    // }
    // const scrollRatio = scrollingArea.scrollLeft / scrollWidth;
    // const oldIndex = scrollRatio;
    // const cardIndex = Math.floor(scrollRatio * cards.length);
    // console.log(scrollingArea.scrollLeft, scrollWidth);
    // // console.log({ oldIndex, cardIndex, direction, newIndex: cardIndex + direction })
    // cards[cardIndex + direction]?.scrollIntoView({ behavior: "smooth", inline:"start" });
  }

};

export class CardElement extends HTMLElement {

  /** @param {{ size?: "normal" | "large" | "small"; wide?: "x" | "y" }} options */
  constructor(options = {}) {
    super();
    const fragment = cardTemplate.content;
    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(fragment.cloneNode(true));

    this.slot = "card";
    if("size" in options) {
      this.size = options.size;
    }
    if("wide" in options) {
      this.wide = options.wide;
    }

  }

  get size() {
    return this.getAttribute("size");
  }

  get wide() {
    return this.getAttribute("wide");
  }

  set size(size) {
    this.setAttribute("size", size);
  }

  /** @param {"x" | "y" | ""} wide */
  set wide(wide) {
    this.setAttribute("wide", wide);
  }

};