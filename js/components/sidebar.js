/* ============================================================
   SIDEBAR — collapsible drawer/panel with session history.
   Mobile: overlay drawer + scrim. Desktop: panel, no scrim.
============================================================ */
(function(){

function esc(str){ return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;"); }

let renamingId = null;
let deletingId = null;

/* ============================================================
   RENDERING
============================================================ */

function render(){
  const list = $("sidebarList");
  if(!list) return;
  // Only finished chats appear in history. A fresh new chat (no messages
  // yet) is not a session until the first message is sent, so it stays out
  // of the list just like ChatGPT/Gemini/Claude do.
  const sorted = [...State.sessions]
    .filter(s => (s.messages || []).length > 0)
    .sort((a,b) => b.updatedAt - a.updatedAt);
  list.innerHTML = sorted.map(s => {
    const active = s.id === State.activeSessionId ? " active" : "";
    const title = esc(s.title || "New chat");
    const renaming = renamingId === s.id;
    return `<div class="session-row${active}" data-id="${esc(s.id)}">
      <div class="session-title">${title}</div>
      <div class="session-actions">
        <button class="session-act" data-act="rename" title="Rename" aria-label="Rename session">✏️</button>
        <button class="session-act" data-act="delete" title="Delete" aria-label="Delete session">🗑️</button>
      </div>
      ${renaming ? `<div class="session-rename"><input type="text" class="session-rename-input" maxlength="80" value="${title}" aria-label="Session title"><button class="session-act session-rename-ok">✓</button></div>` : ""}
    </div>`;
  }).join("");

  list.querySelectorAll(".session-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if(e.target.closest(".session-act")) return;
      if(e.target.closest(".session-rename")) return;
      switchSession(row.dataset.id);
      close();
    });
  });
  list.querySelectorAll(".session-act[data-act=rename]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      renamingId = btn.closest(".session-row").dataset.id;
      deletingId = null;
      render();
      const inp = list.querySelector(".session-rename-input");
      if(inp){ inp.focus(); inp.select(); }
    });
  });
  list.querySelectorAll(".session-act[data-act=delete]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.closest(".session-row").dataset.id;
      if(deletingId === id){
        deletingId = null;
        deleteSession(id);
        render();
      } else {
        deletingId = id;
        renamingId = null;
        render();
        const row = list.querySelector(`.session-row[data-id="${id}"] .session-title`);
        if(row) row.textContent = "Delete this session?";
      }
    });
  });
  list.querySelectorAll(".session-rename-input").forEach(inp => {
    inp.addEventListener("keydown", (e) => {
      if(e.key === "Enter"){ renameSession(renamingId, inp.value); renamingId = null; render(); }
      if(e.key === "Escape"){ renamingId = null; render(); }
    });
  });
  list.querySelectorAll(".session-rename-ok").forEach(btn => {
    btn.addEventListener("click", () => {
      const inp = list.querySelector(".session-rename-input");
      if(inp) renameSession(renamingId, inp.value);
      renamingId = null;
      render();
    });
  });

  const dot = $("sidebarKeyDot");
  if(dot){
    dot.classList.toggle("on", !!State.apiKey);
    dot.title = State.apiKey ? "API key saved" : "No API key saved for this provider";
  }
}

/* ============================================================
   OPEN / CLOSE / TOGGLE
============================================================ */

function open(){
  const sb = $("sidebar"), sc = $("sidebarScrim");
  if(!sb) return;
  sb.classList.add("show");
  sb.setAttribute("aria-hidden", "false");
  setMenuButtonExpanded(true);
  if(sc){ sc.hidden = false; sc.classList.add("show"); }
  const first = $("btnSidebarNewChat");
  if(first) first.focus({ preventScroll:true });
}

function close(){
  const sb = $("sidebar"), sc = $("sidebarScrim");
  if(!sb) return;
  sb.classList.remove("show");
  sb.setAttribute("aria-hidden", "true");
  setMenuButtonExpanded(false);
  if(sc){ sc.classList.remove("show"); setTimeout(() => { sc.hidden = true; }, 200); }
}

function setMenuButtonExpanded(isOpen){
  ["btnMenuDesktop", "btnMenu"].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.setAttribute("aria-expanded", String(isOpen));
  });
}

function toggle(){
  const sb = $("sidebar");
  if(!sb) return;
  sb.classList.contains("show") ? close() : open();
}

/* ============================================================
   EVENTS
============================================================ */

function initEvents(){
  const closeBtn = $("sidebarClose");
  if(closeBtn) closeBtn.addEventListener("click", close);
  const scrim = $("sidebarScrim");
  if(scrim) scrim.addEventListener("click", close);

  const newChat = $("btnSidebarNewChat");
  if(newChat) newChat.addEventListener("click", () => { newSession(); close(); });

  const settingsBtn = $("btnSidebarSettings");
  if(settingsBtn) settingsBtn.addEventListener("click", () => { close(); Settings.open(); });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape" && $("sidebar").classList.contains("show")) close();
  });
}

// Expose globally
window.Sidebar = {
  render,
  open,
  close,
  toggle,
  initEvents
};

})();
