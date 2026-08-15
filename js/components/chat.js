/* ============================================================
   CHAT — message rendering, assistant turn creation, and streaming.
============================================================ */
(function(){

function esc(str){ return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;"); }

/* ============================================================
   SCREEN-READER ANNOUNCEMENTS
============================================================ */

function announce(msg){
  if (typeof document === 'undefined') return;
  const announcer = document.getElementById("aria-announcer");
  if(announcer) announcer.textContent = msg;
}

/* ============================================================
   SCROLL HANDLING
============================================================ */

function initScrollHandling(){
  if (typeof document === 'undefined') return;

  $("chatScroll").addEventListener("scroll", () => {
    State.stickToBottom = ($("chatScroll").scrollHeight - $("chatScroll").scrollTop - $("chatScroll").clientHeight) < 64;
  });
}

function scrollIfSticky(){
  if (typeof document === 'undefined') return;

  if(State.stickToBottom) $("chatScroll").scrollTop = $("chatScroll").scrollHeight;
}

/* ============================================================
   MESSAGE RENDERING
============================================================ */

let renderedCount = 0;

/* Plain-text append that turns http(s) URLs into clickable links.
   Used for system/error bubbles, which otherwise stay text-only
   (no HTML) so a provider error like the Groq terms-acceptance
   message can carry an actionable link. */
function appendWithLinks(el, text){
  const urlRe = /https?:\/\/[^\s<>"']+/g;
  let last = 0, m;
  while((m = urlRe.exec(text))){
    if(m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
    const a = document.createElement("a");
    a.href = m[0];
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = m[0];
    el.appendChild(a);
    last = m.index + m[0].length;
  }
  if(last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
}

/* The streamed assistant turn is already in the DOM (created by
   createAssistantTurn), so the message just pushed to State.messages
   must NOT be re-rendered by the next Chat.render() — advance the
   incremental-render cursor past it. Without this, every later send
   re-rendered the previous reply as a second, duplicate bubble. */
function markMessagesRendered(){
  renderedCount = State.messages.length;
}

function render(){
  if (typeof document === 'undefined') return;

  if(State.notice){
    const noticeRow = document.createElement("div");
    noticeRow.className = "msg system err";
    noticeRow.textContent = State.notice;
    $("chatInner").insertBefore(noticeRow, $("chatInner").firstChild);
    State.notice = null;
  }

  if(State.messages.length < renderedCount){
    $("chatInner").querySelectorAll(".msg").forEach(el => el.remove());
    renderedCount = 0;
  }

  $("chatScroll").classList.toggle("has-messages", State.messages.length > 0);
  if(State.messages.length === 0){
    $("emptyState").style.display = "block";
    return;
  }
  $("emptyState").style.display = "none";

  for(let i = renderedCount; i < State.messages.length; i++){
    const m = State.messages[i];
    const row = document.createElement("div");
    row.className = "msg " + m.role + (m.isError ? " err" : "");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = m.role === "user" ? icon('user_silhouette')
      : (m.role === "system" ? icon('info_circle') : icon('bot_robot_face'));
    row.appendChild(avatar);

    const col = document.createElement("div");
    col.className = "bubble-col";

    if(m.role === "system"){
      const b = document.createElement("div");
      b.className = "bubble";
      appendWithLinks(b, m.content);
      col.appendChild(b);
    } else {
      if(m.role === "assistant" && m.toolUsed){
        const tag = document.createElement("span");
        tag.className = "tool-tag";
        tag.innerHTML = icon('wrench_tools') + " " + esc(m.toolUsed);
        col.appendChild(tag);
      }
      const b = document.createElement("div");
      b.className = "bubble";
      b.innerHTML = Markdown.renderMarkdownish(m.content || "");
      if(m.imageDataUrl){ const img=document.createElement("img"); img.src=m.imageDataUrl; b.appendChild(img); }
      if(m.audioDataUrl){
        // Voice message → WhatsApp-style capsule (waveform + duration),
        // not a bare native <audio> element.
        if(window.VoiceCapsule) VoiceCapsule.build(b, { src: m.audioDataUrl, durationMs: m.audioDurationMs || 0 });
      }
      col.appendChild(b);

      if(m.modelUsed){
        const tag = document.createElement("span");
        tag.className = "model-tag";
        tag.style.alignSelf = m.role==="user" ? "flex-end" : "flex-start";
        tag.textContent = m.modelUsed;
        col.appendChild(tag);
      }
    }

    row.appendChild(col);
    $("chatInner").appendChild(row);
  }

  renderedCount = State.messages.length;
  scrollIfSticky();
}

/* ============================================================
   ASSISTANT TURN
============================================================ */

function createAssistantTurn(){
  if (typeof document === 'undefined') return;

  const row = document.createElement("div");
  row.className = "msg assistant";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.innerHTML = icon('bot_robot_face');
  row.appendChild(avatar);

  const col = document.createElement("div");
  col.className = "bubble-col";

  const phaseWindow = document.createElement("div");
  phaseWindow.className = "phase-window collapsed";
  col.appendChild(phaseWindow);

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  col.appendChild(bubble);

  row.appendChild(col);
  $("chatInner").appendChild(row);
  scrollIfSticky();

  return { row, col, phaseWindow, bubble };
}

/* ============================================================
   PHASE INDICATOR
============================================================ */

const PHASE_COPY = {
  connect:  { kind:"connect",  icon:"ring" },
  thinking: { kind:"thinking", icon:"ring" },
  tool:     { kind:"tool",     icon:"ring" },
  ocr:      { kind:"ocr",      icon:"ring" },
  audio:    { kind:"connect",  icon:"bars" }
};

function setPhase(turn, key, label){
  if (typeof document === 'undefined') return;

  const meta = PHASE_COPY[key] || PHASE_COPY.connect;
  turn.phaseWindow.dataset.done = "";
  turn.phaseWindow.classList.remove("collapsed");
  turn.phaseWindow.innerHTML =
    `<div class="phase-item" data-kind="${meta.kind}">` +
    (meta.icon === "bars"
      ? '<span class="phase-bars"><span></span><span></span><span></span><span></span></span>'
      : '<span class="phase-ring"></span>') +
    `<span class="phase-label"></span></div>`;
  turn.phaseWindow.querySelector(".phase-label").textContent = label;
  scrollIfSticky();
}

function collapsePhase(turn){
  if (typeof document === 'undefined') return;

  if(turn.phaseWindow.dataset.done === "1") return;
  turn.phaseWindow.dataset.done = "1";
  turn.phaseWindow.classList.add("collapsed");
  setTimeout(() => { if(turn.phaseWindow.parentNode) turn.phaseWindow.remove(); }, 380);
}

/* ============================================================
   TURN FINALIZATION
============================================================ */

function finalizeTurn(turn, result, m){
  if (typeof document === 'undefined') return;

  if(result.toolUsed){
    const tag = document.createElement("span");
    tag.className = "tool-tag";
    tag.innerHTML = icon("wrench_tools") + " " + esc(result.toolUsed);
    turn.col.insertBefore(tag, turn.bubble);
  }
  const modelTag = document.createElement("span");
  modelTag.className = "model-tag";
  modelTag.style.alignSelf = "flex-start";
  modelTag.textContent = m.id;
  turn.col.appendChild(modelTag);
  scrollIfSticky();
  if(window.Chat && Chat.announce) Chat.announce("Assistant response complete");
}

/* ============================================================
   TEXT REVEAL
============================================================ */

async function revealText(turn, text){
  if (typeof document === 'undefined') return;

  // Chunked reveal: render a few words per tick instead of one at a time.
  // One-word-at-a-time is O(N²) total render work (cumulative re-render of the
  // whole string per word) plus a 12ms delay floor per word — a 10k-word
  // OCR/transcription output would freeze for minutes. Chunking keeps the
  // typewriter pacing for normal replies (~1 word/tick) but bounds long
  // outputs to ~400 ticks (~5s) with ~1 render per chunk.
  let out = "";
  try{
    const words = text.split(/(\s+)/);
    const perTick = Math.min(64, Math.max(1, Math.round(words.length / 400)));
    for(let i=0;i<words.length;i+=perTick){
      out += words.slice(i, i + perTick).join("");
      const last = i + perTick >= words.length;
      turn.bubble.innerHTML = Markdown.renderMarkdownish(out) + (last ? "" : '<span class="type-cursor"></span>');
      Markdown.scheduleHighlight(turn.bubble);
      scrollIfSticky();
      if(!last) await new Promise(r => setTimeout(r, 12));
    }
    Markdown.enhanceCodeBlocks(turn.bubble);   // final pass once, not per chunk
  } catch(e) {
    console.error("Error in revealText:", e);
    turn.bubble.textContent = out;
    return;
  }
}

// Expose globally
window.Chat = {
  initScrollHandling,
  scrollIfSticky,
  render,
  markMessagesRendered,
  createAssistantTurn,
  setPhase,
  collapsePhase,
  finalizeTurn,
  revealText,
  announce
};

})();

/* The empty-state glyph is static HTML; hydrate it synchronously at load
   (icons.js is already loaded above, so icon() is available immediately). */
(function(){
  const g = document.getElementById("emptyGlyph");
  if(g) g.innerHTML = icon("bot_robot_face");
})();
