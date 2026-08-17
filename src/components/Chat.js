/**
 * Chat component — renders message bubbles, manages assistant turns
 * (phase indicators, thinking popups, streaming), and provides
 * accessibility announcements.
 */

export class Chat {
  constructor(deps) {
    this.deps = deps;
    this.renderedCount = 0;
  }

  esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  announce(msg) {
    if (typeof document === "undefined") return;
    const announcer = document.getElementById("aria-announcer");
    if (announcer) announcer.textContent = msg;
  }

  initScrollHandling() {
    const { $, state } = this.deps;
    const scrollEl = $("chatScroll");
    if (!scrollEl) return;
    scrollEl.addEventListener("scroll", () => {
      state.stickToBottom = ($("chatScroll").scrollHeight - $("chatScroll").scrollTop - $("chatScroll").clientHeight) < 64;
    });
  }

  scrollIfSticky() {
    if (typeof document === "undefined") return;
    const { $, state } = this.deps;
    if (state.stickToBottom) $("chatScroll").scrollTop = $("chatScroll").scrollHeight;
  }

  appendWithLinks(el, text) {
    const urlRe = /https?:\/\/[^\s<>"']+/g;
    let last = 0, m;
    while ((m = urlRe.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = document.createElement("a");
      a.href = m[0];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = m[0];
      el.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  markMessagesRendered() {
    this.renderedCount = this.deps.state.messages.length;
  }

  render() {
    if (typeof document === "undefined") return;
    const { $, state, icon, markdown } = this.deps;
    const m = state;

    if (m.notice) {
      const noticeRow = document.createElement("div");
      noticeRow.className = "msg system err";
      noticeRow.textContent = m.notice;
      $("chatInner").insertBefore(noticeRow, $("chatInner").firstChild);
      m.notice = null;
    }

    if (m.messages.length < this.renderedCount) {
      $("chatInner").querySelectorAll(".msg").forEach((el) => el.remove());
      this.renderedCount = 0;
    }

    const chatScroll = $("chatScroll");
    if (chatScroll) chatScroll.classList.toggle("has-messages", m.messages.length > 0);
    const emptyState = $("emptyState");
    if (m.messages.length === 0) {
      if (emptyState) emptyState.style.display = "block";
      return;
    }
    if (emptyState) emptyState.style.display = "none";

    for (let i = this.renderedCount; i < m.messages.length; i++) {
      const mm = m.messages[i];
      const row = document.createElement("div");
      row.className = "msg " + mm.role + (mm.isError ? " err" : "");

      const avatar = document.createElement("div");
      avatar.className = "avatar";

      if (mm.role === "assistant") {
        const robotAvatar = this.deps.robotAvatar;
        if (robotAvatar) {
          robotAvatar.buildInline(avatar);
          robotAvatar.setState(avatar, "thinking");
        } else {
          avatar.innerHTML = icon("bot_robot_face");
        }
      } else if (mm.role === "system") {
        avatar.innerHTML = icon("info_circle");
      } else {
        avatar.innerHTML = icon("user_silhouette");
      }
      row.appendChild(avatar);

      const col = document.createElement("div");
      col.className = "bubble-col";

      if (mm.role === "system") {
        const b = document.createElement("div");
        b.className = "bubble";
        this.appendWithLinks(b, mm.content);
        col.appendChild(b);
      } else {
        if (mm.role === "assistant" && mm.toolUsed) {
          const tag = document.createElement("span");
          tag.className = "tool-tag";
          tag.innerHTML = icon("wrench_tools") + " " + this.esc(mm.toolUsed);
          col.appendChild(tag);
        }
        const b = document.createElement("div");
        b.className = "bubble";
        b.innerHTML = markdown.renderMarkdownish(mm.content || "");
        if (mm.imageDataUrl) { const img = document.createElement("img"); img.src = mm.imageDataUrl; b.appendChild(img); }
        if (mm.audioDataUrl) {
          const vc = this.deps.voiceCapsule;
          if (vc) vc.build(b, { src: mm.audioDataUrl, durationMs: mm.audioDurationMs || 0 });
        }
        col.appendChild(b);

        if (mm.modelUsed) {
          const tag = document.createElement("span");
          tag.className = "model-tag";
          tag.style.alignSelf = mm.role === "user" ? "flex-end" : "flex-start";
          tag.textContent = mm.modelUsed;
          col.appendChild(tag);
        }
      }

      row.appendChild(col);
      $("chatInner").appendChild(row);
    }

    this.renderedCount = m.messages.length;
    this.scrollIfSticky();
  }

  createAssistantTurn() {
    if (typeof document === "undefined") return null;
    const { $, robotAvatar, icon } = this.deps;

    const row = document.createElement("div");
    row.className = "msg assistant";

    // Animated robot avatar (inline size)
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    if (robotAvatar) {
      robotAvatar.buildInline(avatar);
      robotAvatar.setState(avatar, "thinking");
    } else {
      avatar.innerHTML = icon("bot_robot_face");
    }
    row.appendChild(avatar);

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
    this.scrollIfSticky();

    return { row, col, phaseWindow, thinkingPopup, bubble, avatar };
  }

  PHASE_COPY = {
    connect:  { kind: "connect",  icon: "ring" },
    thinking: { kind: "thinking", icon: "ring" },
    tool:     { kind: "tool",     icon: "ring" },
    ocr:      { kind: "ocr",      icon: "ring" },
    audio:    { kind: "connect",  icon: "bars" }
  };

  setPhase(turn, key, label) {
    if (typeof document === "undefined") return;
    const { icon } = this.deps;

    const meta = this.PHASE_COPY[key] || this.PHASE_COPY.connect;
    turn.phaseWindow.dataset.done = "";
    turn.phaseWindow.classList.remove("collapsed");
    turn.phaseWindow.innerHTML =
      `<div class="phase-item" data-kind="${meta.kind}">` +
      (meta.icon === "bars"
        ? '<span class="phase-bars"><span></span><span></span><span></span><span></span></span>'
        : '<span class="phase-ring"></span>') +
      `<span class="phase-label"></span></div>`;
    const phaseLabel = turn.phaseWindow.querySelector(".phase-label");
    if (phaseLabel) phaseLabel.textContent = label;

    // Animate robot: thinking state
    if (turn.avatar && this.deps.robotAvatar) {
      this.deps.robotAvatar.setState(turn.avatar, "thinking");
    }

    // Show thinking popup for thinking/reasoning phase
    if (key === "thinking" && turn.thinkingPopup) {
      turn.thinkingPopup.style.display = "block";
      turn.thinkingPopup.innerHTML = `<div class="thinking-popup-header"><span class="thinking-pulse-dot"></span><span>Thinking…</span></div><div class="thinking-popup-lines" id="thinkLines_${Date.now()}"></div>`;
      turn._thinkLinesEl = turn.thinkingPopup.querySelector('[id^="thinkLines_"]');
    }

    this.scrollIfSticky();
  }

  appendThinkingLine(turn, line) {
    if (!turn._thinkLinesEl || !line.trim()) return;
    const p = document.createElement("p");
    p.className = "think-line";
    p.textContent = line;
    turn._thinkLinesEl.appendChild(p);
    // Auto-scroll the popup itself
    const popup = turn.thinkingPopup;
    if (popup) popup.scrollTop = popup.scrollHeight;
    this.scrollIfSticky();
  }

  collapsePhase(turn) {
    if (typeof document === "undefined") return;

    if (turn.phaseWindow.dataset.done === "1") return;
    turn.phaseWindow.dataset.done = "1";
    turn.phaseWindow.classList.add("collapsed");
    setTimeout(() => { if (turn.phaseWindow.parentNode) turn.phaseWindow.remove(); }, 380);

    // Hide thinking popup when model starts speaking
    if (turn.thinkingPopup) {
      turn.thinkingPopup.classList.add("thinking-popup-hide");
      setTimeout(() => {
        if (turn.thinkingPopup) {
          turn.thinkingPopup.style.display = "none";
          turn.thinkingPopup.classList.remove("thinking-popup-hide");
        }
      }, 350);
    }

    // Switch robot to speaking state
    if (turn.avatar && this.deps.robotAvatar) {
      this.deps.robotAvatar.setState(turn.avatar, "speaking");
    }
  }

  finalizeTurn(turn, result, m) {
    if (typeof document === "undefined") return;
    const { icon } = this.deps;

    if (result.toolUsed) {
      const tag = document.createElement("span");
      tag.className = "tool-tag";
      tag.innerHTML = icon("wrench_tools") + " " + this.esc(result.toolUsed);
      turn.col.insertBefore(tag, turn.bubble);
    }
    const modelTag = document.createElement("span");
    modelTag.className = "model-tag";
    modelTag.style.alignSelf = "flex-start";
    modelTag.textContent = m.id;
    turn.col.appendChild(modelTag);

    // Return robot to idle
    if (turn.avatar && this.deps.robotAvatar) {
      this.deps.robotAvatar.setState(turn.avatar, "idle");
    }

    this.scrollIfSticky();
    this.announce("Assistant response complete");
  }

  async revealText(turn, text) {
    if (typeof document === "undefined") return;
    const { markdown } = this.deps;

    // Switch to speaking state as soon as text starts flowing
    if (turn.avatar && this.deps.robotAvatar) {
      this.deps.robotAvatar.setState(turn.avatar, "speaking");
    }

    let out = "";
    try {
      const words = text.split(/(\s+)/);
      const perTick = Math.min(64, Math.max(1, Math.round(words.length / 400)));
      for (let i = 0; i < words.length; i += perTick) {
        out += words.slice(i, i + perTick).join("");
        const last = i + perTick >= words.length;
        turn.bubble.innerHTML = markdown.renderMarkdownish(out) + (last ? "" : '<span class="type-cursor"></span>');
        markdown.scheduleHighlight(turn.bubble);
        this.scrollIfSticky();
        if (!last) await new Promise((r) => setTimeout(r, 12));
      }
      markdown.enhanceCodeBlocks(turn.bubble);
    } catch (e) {
      console.error("Error in revealText:", e);
      turn.bubble.textContent = out;
    }
  }

  // Build callbacks for the Api's streaming methods
  buildStreamingCallbacks(turn) {
    const self = this;
    const { markdown } = this.deps;

    return {
      onPhase: (key, label) => self.setPhase(turn, key, label),
      onFirstToken: () => {
        self.collapsePhase(turn);
      },
      onToken: (fullText) => {
        turn.bubble.innerHTML = markdown.renderMarkdownish(fullText) + '<span class="type-cursor"></span>';
        markdown.scheduleHighlight(turn.bubble);
        self.scrollIfSticky();
      },
      onThinking: (text) => {
        self.appendThinkingLine(turn, text);
      },
      onDone: (fullText) => {
        if (fullText) turn.bubble.innerHTML = markdown.renderMarkdownish(fullText);
        markdown.enhanceCodeBlocks(turn.bubble);
      },
      onScroll: () => {
        self.scrollIfSticky();
      },
      onAudio: (src, blob) => {
        turn.bubble.innerHTML = "";
        if (self.deps.voiceCapsule) self.deps.voiceCapsule.build(turn.bubble, { src, raw: blob });
        self.scrollIfSticky();
      }
    };
  }

  // Initialize the robot hero in the empty state
  initHero() {
    const { $, robotAvatar, icon } = this.deps;
    const g = $("emptyGlyph");
    if (g && robotAvatar) {
      if (!g.querySelector(".robot-svg")) {
        robotAvatar.buildHero(g);
      }
    } else if (g) {
      g.innerHTML = icon("bot_robot_face");
    }
  }
}
