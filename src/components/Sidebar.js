/**
 * Sidebar component — session list, new chat button, settings shortcut,
 * and key status indicator.
 */

import { trapFocus } from "../utils/dom.js";

export class Sidebar {
  constructor(deps) {
    this.deps = deps;
    this.renamingId = null;
    this.deletingId = null;
    this._focusTrapHandler = null;
  }

  render() {
    const { $, state, icon } = this.deps;
    const list = $("sidebarList");
    if (!list) return;

    // Only finished chats appear — a fresh new chat (no messages yet) stays out
    // of the list, matching ChatGPT/Gemini/Claude behavior.
    const sorted = [...state.sessions]
      .filter((s) => (s.messages || []).length > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    list.innerHTML = sorted.map((s) => {
      const active = s.id === state.activeSessionId ? " active" : "";
      const title = this.deps.escHtml(s.title || "New chat");
      const renaming = this.renamingId === s.id;
      const esc = (str) => this.deps.escHtml(str);

      return `<div class="session-row${active}" data-id="${esc(s.id)}">
        <div class="session-title">${title}</div>
        <div class="session-actions">
          <button class="session-act" data-act="rename" title="Rename" aria-label="Rename session">${icon("pencil_edit")}</button>
          <button class="session-act" data-act="delete" title="Delete" aria-label="Delete session">${icon("trash_delete")}</button>
        </div>
        ${renaming ? `<div class="session-rename"><input type="text" class="session-rename-input" maxlength="80" value="${title}" aria-label="Session title"><button class="session-act session-rename-ok">${icon("check_confirm")}</button></div>` : ""}
      </div>`;
    }).join("");

    list.querySelectorAll(".session-row").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".session-act")) return;
        if (e.target.closest(".session-rename")) return;
        state.switchSession(row.dataset.id);
        this.close();
      });
    });
    list.querySelectorAll(".session-act[data-act=rename]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.renamingId = btn.closest(".session-row").dataset.id;
        this.deletingId = null;
        this.render();
        const inp = list.querySelector(".session-rename-input");
        if (inp) { inp.focus(); inp.select(); }
      });
    });
    list.querySelectorAll(".session-act[data-act=delete]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.closest(".session-row").dataset.id;
        if (this.deletingId === id) {
          this.deletingId = null;
          state.deleteSession(id);
          this.render();
        } else {
          this.deletingId = id;
          this.renamingId = null;
          this.render();
          const rowEl = list.querySelector(`.session-row[data-id="${id}"] .session-title`);
          if (rowEl) rowEl.textContent = "Delete this session?";
        }
      });
    });
    list.querySelectorAll(".session-rename-input").forEach((inp) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { state.renameSession(this.renamingId, inp.value); this.renamingId = null; this.render(); }
        if (e.key === "Escape") { this.renamingId = null; this.render(); }
      });
    });
    list.querySelectorAll(".session-rename-ok").forEach((btn) => {
      btn.addEventListener("click", () => {
        const inp = list.querySelector(".session-rename-input");
        if (inp) state.renameSession(this.renamingId, inp.value);
        this.renamingId = null;
        this.render();
      });
    });

    const dot = $("sidebarKeyDot");
    if (dot) {
      dot.classList.toggle("on", !!state.apiKey);
      dot.title = state.apiKey ? "API key saved" : "No API key saved for this provider";
    }
  }

  open() {
    const { $ } = this.deps;
    const sb = $("sidebar"), sc = $("sidebarScrim");
    if (!sb) return;
    sb.classList.add("show");
    sb.setAttribute("aria-hidden", "false");
    this.setMenuButtonExpanded(true);
    if (sc) { sc.hidden = false; sc.classList.add("show"); }
    const first = $("btnSidebarNewChat");
    if (first) first.focus({ preventScroll: true });
    // Focus trap
    this._focusTrapHandler = trapFocus(sb);
    document.addEventListener("keydown", this._focusTrapHandler);
  }

  close() {
    const { $ } = this.deps;
    const sb = $("sidebar"), sc = $("sidebarScrim");
    if (!sb) return;
    // Restore focus to the menu button that opened the sidebar
    const trigger = $("btnMenuDesktop") || $("btnMenu");
    sb.classList.remove("show");
    sb.setAttribute("aria-hidden", "true");
    this.setMenuButtonExpanded(false);
    if (trigger) trigger.focus({ preventScroll: true });
    if (sc) { sc.classList.remove("show"); setTimeout(() => { sc.hidden = true; }, 200); }
    // Remove focus trap
    if (this._focusTrapHandler) {
      document.removeEventListener("keydown", this._focusTrapHandler);
      this._focusTrapHandler = null;
    }
  }

  setMenuButtonExpanded(isOpen) {
    const { $ } = this.deps;
    ["btnMenuDesktop", "btnMenu"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.setAttribute("aria-expanded", String(isOpen));
    });
  }

  toggle() {
    const { $ } = this.deps;
    const sb = $("sidebar");
    if (!sb) return;
    sb.classList.contains("show") ? this.close() : this.open();
  }

  initEvents() {
    const { $, state, showToast, settings } = this.deps;

    const closeBtn = $("sidebarClose");
    if (closeBtn) closeBtn.addEventListener("click", () => this.close());
    const scrim = $("sidebarScrim");
    if (scrim) scrim.addEventListener("click", () => this.close());

    const newChat = $("btnSidebarNewChat");
    if (newChat) newChat.addEventListener("click", () => { state.newSession(); this.close(); });

    const settingsBtn = $("btnSidebarSettings");
    if (settingsBtn) settingsBtn.addEventListener("click", () => { this.close(); settings.open(); });

    document.querySelectorAll(".feat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = (btn.dataset.feat || "Feature").trim();
        showToast(name + " — coming soon");
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("sidebar").classList.contains("show")) this.close();
    });
  }

  // Initialize the brand glyph on construction
  initBrandGlyph() {
    const { $, icon } = this.deps;
    const bg = $("brandGlyph");
    if (bg) bg.innerHTML = icon("bot_robot_face");
  }

}
