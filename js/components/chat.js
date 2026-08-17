(function(){

function esc(str){ return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

function announce(msg){
  if (typeof document === 'undefined') return;
  const announcer = document.getElementById("aria-announcer");
  if(announcer) announcer.textContent = msg;
}

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

let renderedCount = 0;

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
  const emptyState = $("emptyState");
  if(State.messages.length === 0){
    if(emptyState) emptyState.style.display = "block";
    return;
  }
  if(emptyState) emptyState.style.display = "none";

  for(let i = renderedCount; i < State.messages.length; i++){
    const m = State.messages[i];
    const row = document.createElement("div");
    row.className = "msg " + m.role + (m.isError ? " err" : "");

    const avatar = document.createElement("div");
    avatar.className = "avatar";

    if(m.role === "assistant"){
      // Animated robot inline avatar
      if(window.RobotAvatar){
        RobotAvatar.buildInline(avatar);
      } else {
        avatar.innerHTML = icon('bot_robot_face');
      }
    } else if(m.role === "system"){
      avatar.innerHTML = icon('info_circle');
    } else {
      avatar.innerHTML = icon('user_silhouette');
    }
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

function createAssistantTurn(){
  if (typeof document === 'undefined') return;

  const row = document.createElement("div");
  row.className = "msg assistant";

  // Animated robot avatar (inline size)
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  if(window.RobotAvatar){
    RobotAvatar.buildInline(avatar);
    // Start in thinking state immediately
    RobotAvatar.setState(avatar, 'thinking');
  } else {
    avatar.innerHTML = icon('bot_robot_face');
  }
  row.appendChild(avatar);
  row._robotAvatar = avatar;  // keep reference for state changes

  const col = document.createElement("div");
  col.className = "bubble-col";

  const phaseWindow = document.createElement("div");
  phaseWindow.className = "phase-window collapsed";
  col.appendChild(phaseWindow);

  // Live thinking popup — shown while model is in thinking phase
  const thinkingPopup = document.createElement("div");
  thinkingPopup.className = "thinking-popup";
  thinkingPopup.style.display = "none";
  col.appendChild(thinkingPopup);

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  col.appendChild(bubble);

  row.appendChild(col);
  $("chatInner").appendChild(row);
  scrollIfSticky();

  return { row, col, phaseWindow, thinkingPopup, bubble, avatar };
}

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

  // Animate robot: thinking state
  if(turn.avatar && window.RobotAvatar){
    const state = key === "thinking" || key === "connect" ? "thinking" : "thinking";
    RobotAvatar.setState(turn.avatar, state);
  }

  // Show thinking popup for thinking/reasoning phase
  if(key === "thinking" && turn.thinkingPopup){
    turn.thinkingPopup.style.display = "block";
    turn.thinkingPopup.innerHTML = `<div class="thinking-popup-header"><span class="thinking-pulse-dot"></span><span>Thinking…</span></div><div class="thinking-popup-lines" id="thinkLines_${Date.now()}"></div>`;
    turn._thinkLinesEl = turn.thinkingPopup.querySelector('[id^="thinkLines_"]');
  }

  scrollIfSticky();
}

function appendThinkingLine(turn, line){
  if(!turn._thinkLinesEl || !line.trim()) return;
  const p = document.createElement("p");
  p.className = "think-line";
  p.textContent = line;
  turn._thinkLinesEl.appendChild(p);
  // Auto-scroll the popup itself
  const popup = turn.thinkingPopup;
  if(popup) popup.scrollTop = popup.scrollHeight;
  scrollIfSticky();
}

function collapsePhase(turn){
  if (typeof document === 'undefined') return;

  if(turn.phaseWindow.dataset.done === "1") return;
  turn.phaseWindow.dataset.done = "1";
  turn.phaseWindow.classList.add("collapsed");
  setTimeout(() => { if(turn.phaseWindow.parentNode) turn.phaseWindow.remove(); }, 380);

  // Hide thinking popup when model starts speaking
  if(turn.thinkingPopup){
    turn.thinkingPopup.classList.add("thinking-popup-hide");
    setTimeout(() => {
      if(turn.thinkingPopup){
        turn.thinkingPopup.style.display = "none";
        turn.thinkingPopup.classList.remove("thinking-popup-hide");
      }
    }, 350);
  }

  // Switch robot to speaking state
  if(turn.avatar && window.RobotAvatar){
    RobotAvatar.setState(turn.avatar, 'speaking');
  }
}

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

  // Return robot to idle
  if(turn.avatar && window.RobotAvatar){
    RobotAvatar.setState(turn.avatar, 'idle');
  }

  scrollIfSticky();
  if(window.Chat && Chat.announce) Chat.announce("Assistant response complete");
}

async function revealText(turn, text){
  if (typeof document === 'undefined') return;

  // Switch to speaking state as soon as text starts flowing
  if(turn.avatar && window.RobotAvatar){
    RobotAvatar.setState(turn.avatar, 'speaking');
  }

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
    Markdown.enhanceCodeBlocks(turn.bubble);
  } catch(e) {
    console.error("Error in revealText:", e);
    turn.bubble.textContent = out;
  }
}

window.Chat = {
  initScrollHandling,
  scrollIfSticky,
  render,
  markMessagesRendered,
  createAssistantTurn,
  setPhase,
  appendThinkingLine,
  collapsePhase,
  finalizeTurn,
  revealText,
  announce
};

})();

// Hydrate the empty-state hero with animated robot
(function(){
  const g = document.getElementById("emptyGlyph");
  if(g && window.RobotAvatar){
    RobotAvatar.buildHero(g);
  } else if(g && window.icon){
    g.innerHTML = icon("bot_robot_face");
  }
})();
