/**
 * Header component — renders the model pill, capability strip, and
 * handles menu button interactions.
 */

export class Header {
  constructor(deps) {
    this.deps = deps;
  }

  render() {
    const { $, state, config, icon } = this.deps;
    const m = state.currentModel();
    if (!m) return;

    const nm = $("modelPillName");
    if (nm) nm.textContent = config.getModelLabel(m);

    const capsOn = Object.keys(m.capabilities || {}).filter((k) => m.capabilities[k]);
    const stripHtml = capsOn.length
      ? capsOn.map((k) => `<span class="cap-chip-live on" title="${config.CAP_META[k].label}">${config.capIcon(k, icon)}</span>`).join("")
      : `<span class="cap-chip-live" title="Text only">${icon("pencil_edit")}</span>`;
    const capStrip = $("capStrip");
    if (capStrip) capStrip.innerHTML = stripHtml;
    const capStripDesktop = $("capStripDesktop");
    if (capStripDesktop) capStripDesktop.innerHTML = stripHtml;

    const endpoint = config.getEndpointType(m.capabilities || {});

    const promptInput = $("promptInput");
    if (promptInput) {
      promptInput.placeholder =
        endpoint === "transcription" ? "Attach audio below to transcribe" :
        endpoint === "tts" ? "Type text to convert to speech…" :
        endpoint === "embeddings" ? "Type text to generate embeddings…" :
        endpoint === "moderation" ? "Type text to moderate…" :
        "Message " + config.getModelLabel(m);
    }

    const composerHint = $("composerHint");
    if (composerHint) {
      composerHint.textContent =
        endpoint === "transcription" ? "Attach an audio clip, then send" :
        endpoint === "tts" ? "Type text, then send to generate audio" :
        endpoint === "embeddings" ? "Type text, then send to get vector embeddings" :
        endpoint === "moderation" ? "Type text, then send to check content safety" :
        "Enter to send · Shift+Enter for new line";
    }
  }

  initEvents() {
    const { $, sidebar, settings } = this.deps;
    const menu = $("btnMenu");
    if (menu) menu.addEventListener("click", () => sidebar.toggle());
    const menuDesktop = $("btnMenuDesktop");
    if (menuDesktop) menuDesktop.addEventListener("click", () => sidebar.toggle());

    const keyBtnDesktop = $("keyBtnDesktop");
    if (keyBtnDesktop) keyBtnDesktop.addEventListener("click", () => settings.open());
  }
}
