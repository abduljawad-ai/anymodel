/* ============================================================
   HEADER — mobile and desktop header components.
============================================================ */
(function(){

/* ============================================================
   RENDERING
============================================================ */

function render(){
  const m = currentModel();
  if(!m) return;

  // Update composer model pill (name only, no swatch)
  const nm = $("modelPillName");
  if(nm){ nm.textContent = Config.getModelLabel(m); }

  // Update capability strip
  const capsOn = Object.keys(m.capabilities || {}).filter(k => m.capabilities[k]);
  const stripHtml = capsOn.length
    ? capsOn.map(k => `<span class="cap-chip-live on" title="${Config.CAP_META[k].label}">${Config.capIcon(k)}</span>`).join("")
    : `<span class="cap-chip-live" title="Text only">${icon('pencil_edit')}</span>`;
  $("capStrip").innerHTML = stripHtml;
  if($("capStripDesktop")) $("capStripDesktop").innerHTML = stripHtml;

  const endpoint = Config.getEndpointType(m.capabilities || {});

  // Update placeholder text
  $("promptInput").placeholder =
    (endpoint === "transcription") ? "Attach audio below to transcribe" :
    (endpoint === "tts") ? "Type text to convert to speech…" :
    (endpoint === "embeddings") ? "Type text to generate embeddings…" :
    (endpoint === "moderation") ? "Type text to moderate…" :
    "Message " + Config.getModelLabel(m);

  $("composerHint").textContent =
    (endpoint === "transcription") ? "Attach an audio clip, then send" :
    (endpoint === "tts") ? "Type text, then send to generate audio" :
    (endpoint === "embeddings") ? "Type text, then send to get vector embeddings" :
    (endpoint === "moderation") ? "Type text, then send to check content safety" :
    "Enter to send · Shift+Enter for new line";
}

/* ============================================================
   EVENTS
============================================================ */

function initEvents(){
  // Sidebar toggle
  const menu = $("btnMenu");
  if(menu) menu.addEventListener("click", () => Sidebar.toggle());
  const menuDesktop = $("btnMenuDesktop");
  if(menuDesktop) menuDesktop.addEventListener("click", () => Sidebar.toggle());

  // Settings button (desktop key dot only)
  const keyBtnDesktop = $("keyBtnDesktop");
  if(keyBtnDesktop) keyBtnDesktop.addEventListener("click", () => Settings.open());
}

// Expose globally
window.Header = {
  render,
  initEvents
};

})();