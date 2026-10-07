const { titleBarTemplate } = await eazuse(import.meta.resolve("./title-bar.html"));

export default class TitleBar extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: "closed" });
    shadowRoot.appendChild(titleBarTemplate.content.cloneNode(true));
    const windowControls = shadowRoot.getElementById("windowControls");
    const [ minimizeControl, restoreControl, closeControl ] = windowControls.children;
    minimizeControl.addEventListener("click", () => electronAPI.invoke("window:minimize"));
    restoreControl.addEventListener("click", () => electronAPI.invoke("window:toggleMaximize"));
    closeControl.addEventListener("click", () => electronAPI.invoke("window:close"));
  }
};