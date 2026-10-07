import ExtendedEventTarget from "../../modules/extended-event.js";
import { sleep } from "../../scripts/promise.js";

/** @extends {ExtendedEventTarget<{ progressUpdate: { progress: number } }>} */
export default class ProgressCanvas extends ExtendedEventTarget {

  #barConfig;
  #relativeMouse = { x: 0, y: 0 };
  #oldData = [[], []];
  #data = [[], []];
  #progress = 0;
  #canvas;
  #context;

  /** @param {{ canvas?: HTMLCanvasElement; bar?: { margin?: number; width?: number; height?: number; color?: string; hoverColor?: string; shadow?: { scale?: number; color?: string; hoverColor?: string; }; progress?: { color?: string; hoverColor?: string; shadow?: { color?: string; hoverColor?: string } } } }} [options] */
  constructor(options) {
    super();
    this.#canvas = options?.canvas ?? document.createElement("canvas");
    this.#context = this.#canvas.getContext("2d");
    this.#barConfig = {
      margin: options?.bar?.margin ?? 0,
      width: options?.bar?.width ?? 1,
      height: options?.bar?.height ?? this.#canvas.height / 2,
      color: options?.bar?.color ?? "#ccc",
      hoverColor: options?.bar?.hoverColor ?? "#888",
      shadow: {
        scale: options?.bar?.shadow?.scale ?? 0.5,
        color: options?.bar?.shadow?.color ?? "#eee",
        hoverColor: options?.bar?.shadow?.hoverColor ?? "#bbb"
      },
      progress: {
        color: options?.bar?.progress?.color ?? "#999",
        hoverColor: options?.bar?.progress?.color ?? "#777",
        shadow: {
          color: options?.bar?.shadow?.progressColor ?? "#ccc",
          hoverColor: options?.bar?.shadow?.progressColor ?? "#aaa"
        }
      },
    };

    this.#canvas.style.userSelect = "none";

    const onclick = () => {
      this.#progress = this.#relativeMouse.x / this.#canvas.width;
      this.trigger("progressUpdate", { progress: this.#progress });
      onmouseleave();
    };
    /** @param {MouseEvent} event */
    const onmousemove = event => {
      this.#relativeMouse.x = event.offsetX;
      this.#relativeMouse.y = event.offsetY;
    };
    const onmouseleave = () => {
      this.#relativeMouse.x = 0;
      this.#relativeMouse.y = 0;
      this.#canvas.removeEventListener("mousemove", onmousemove);
      this.#canvas.removeEventListener("mouseup", onclick);
    };
    /** @param {MouseEvent} event */
    const onmousedown = event => {
      this.#relativeMouse.x = event.offsetX;
      this.#relativeMouse.y = event.offsetY;
      this.#canvas.addEventListener("mousemove", onmousemove);
      this.#canvas.addEventListener("mouseup", onclick);
      window.addEventListener("mouseup", onmouseleave);
    };
    this.#canvas.addEventListener("mousedown", onmousedown);
    window.addEventListener("mouseleave", onmouseleave);
    addEventListener("blur", onmouseleave);

  }

  set width(value) {
    this.#canvas.width = value;
  }

  /** @param {number} margin */
  set barMargin(margin) {
    return this.#barConfig.margin = margin;
  }

  /** @param {number} width */
  set barWidth(width) {
    return this.#barConfig.width = width;
  }

  /** @param {number} height */
  set barHeight(height) {
    return this.#barConfig.height = height;
  }

  /** @param {number} value */
  set progress(value) {
    this.#progress = value;
  }

  setData(data = []) {
    this.#oldData = this.#data;
    this.#data = data;
    if(this.#data[0].length > 0) {
      this.#barConfig.width = Math.max(1, Math.floor(this.#canvas.width / this.#data[0].length));
    }
    this.#animationPercent = 0;
  }

  clearData() {
    this.setData([
      this.#data[0].map(() => 0),
      this.#data[1].map(() => 0)
    ]);
    this.#animationPercent = 0;
  }

  /**
   * @param {number} [width]
   * @param {number} [height]
   */
  resize(width = this.#canvas.width, height = this.#canvas.height) {
    this.#canvas.width = width;
    this.#canvas.height = height;
    this.#barConfig.height = this.#canvas.height / 2;
    if(this.#data[0].length > 0) {
      this.#barConfig.width = Math.max(1, Math.floor(width / this.#data[0].length));
    }
    this.#animationPercent = 0;
  }

  #isLoading = false;
  #animationPercent = 0;
  #time = 0;
  #draw() {
    // AND Gate

    this.#context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

    if(this.#isLoading) {
      this.#context.beginPath();
      for(let x = 20; x < this.#canvas.width - 20; x++) {
        const y = Math.sin((x + this.#time) / 10) * 5;
        this.#context.lineTo(x, y + this.#canvas.height / 2);
      }
      this.#context.lineWidth = 2;
      this.#context.lineCap = "round";
      this.#context.strokeStyle = this.#barConfig.shadow.color;
      this.#context.stroke();
      this.#context.closePath();
      this.#time++;
      return;
    }

    let barX = this.#barConfig.margin;
    const dataSize = this.#data[0].length;
    for(let index = 0; index < dataSize; index++) {

      const data0 = Math.abs(this.#data[0][index]);
      const oldData0 = Math.abs(this.#oldData[0][index] ?? 0);
      const displacement0 = data0 - oldData0;
      const position0 = oldData0 + displacement0 * this.#animationPercent;
      const barHeight0 = Math.abs(position0) * this.#barConfig.height;

      const data1 = Math.abs(this.#data[1][index]);
      const oldData1 = Math.abs(this.#oldData[1][index] ?? 0);
      const displacement1 = data1 - oldData1;
      const position1 = oldData1 + displacement1 * this.#animationPercent;
      const barHeight1 = Math.abs(position1) * this.#barConfig.height;

      this.#animationPercent = Math.min(this.#animationPercent + 1 / 1000, 1);
      const barY = this.#barConfig.height - barHeight0;

      // const barXEnd = barX + this.#barConfig.width;
      const isMouseHovered = this.#relativeMouse.x > barX;
      const isUnderProgress = index < this.#progress * dataSize;

      // draw bar
      if(isMouseHovered && isUnderProgress) {
        this.#context.fillStyle = this.#barConfig.progress.hoverColor;
      } else if(isMouseHovered) {
        this.#context.fillStyle = this.#barConfig.hoverColor;
      } else if(isUnderProgress) {
        this.#context.fillStyle = this.#barConfig.progress.color;
      } else {
        this.#context.fillStyle = this.#barConfig.color;
      }
      this.#context.fillRect(barX, barY, this.#barConfig.width, barHeight0);

      // draw bar shadow
      if(isMouseHovered && isUnderProgress) {
        this.#context.fillStyle = this.#barConfig.progress.shadow.hoverColor;
      } else if(isMouseHovered) {
        this.#context.fillStyle = this.#barConfig.shadow.hoverColor;
      } else if(isUnderProgress) {
        this.#context.fillStyle = this.#barConfig.progress.shadow.color;
      } else {
        this.#context.fillStyle = this.#barConfig.shadow.color;
      }
      this.#context.fillRect(barX, barY + barHeight0, this.#barConfig.width, barHeight1 * this.#barConfig.shadow.scale);

      barX += this.#barConfig.margin + this.#barConfig.width;

    }

  }

  /** @type {number | undefined} */
  #animationFrameId;
  #shouldDraw = false;

  async init() {
    if(this.#shouldDraw === true) {
      return;
    }
    this.#shouldDraw = true;
    while(this.#shouldDraw) {
      await sleep(18);
      await new Promise(resolve => {
        cancelAnimationFrame(this.#animationFrameId);
        this.#animationFrameId = requestAnimationFrame(resolve);
      });
      this.#draw();
    }
  }

  destroy() {
    cancelAnimationFrame(this.#animationFrameId);
    this.#animationFrameId = undefined;
    this.#shouldDraw = false;
  }

  static randomInt(max, min = 0) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

};