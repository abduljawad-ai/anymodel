/* ============================================================
   CHAT — message rendering, assistant turn creation, and streaming.
============================================================ */
(function(){

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
    avatar.textContent = m.role === "user" ? "U" : (m.role === "system" ? "!" : "🤖");
    row.appendChild(avatar);

    const col = document.createElement("div");
    col.className = "bubble-col";

    if(m.role === "system"){
      const b = document.createElement("div");
      b.className = "bubble";
      b.textContent = m.content;
      col.appendChild(b);
    } else {
      if(m.role === "assistant" && m.toolUsed){
        const tag = document.createElement("span");
        tag.className = "tool-tag";
        tag.textContent = "🛠️ " + m.toolUsed;
        col.appendChild(tag);
      }
      const b = document.createElement("div");
      b.className = "bubble";
      b.innerHTML = Markdown.renderMarkdownish(m.content || "");
      if(m.imageDataUrl){ const img=document.createElement("img"); img.src=m.imageDataUrl; b.appendChild(img); }
      if(m.audioDataUrl){ const audio=document.createElement("audio"); audio.controls=true; audio.src=m.audioDataUrl; b.appendChild(audio); }
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
  avatar.textContent = "🤖";
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
    tag.textContent = "🛠️ " + result.toolUsed;
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

  let out = "";
  try{
    const words = text.split(/(\s+)/);
    for(let i=0;i<words.length;i++){
      out += words[i];
      const last = i === words.length - 1;
      turn.bubble.innerHTML = Markdown.renderMarkdownish(out) + (last ? "" : '<span class="type-cursor"></span>');
      Markdown.scheduleHighlight(turn.bubble);
      scrollIfSticky();
      if(!last) await new Promise(r => setTimeout(r, 12));
    }
    Markdown.enhanceCodeBlocks(turn.bubble);   // final pass once, not per word
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
