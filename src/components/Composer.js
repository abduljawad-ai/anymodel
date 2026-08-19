/**
 * Composer component — the message input area.
 *
 * Handles: text input, file attachments (image/audio), voice recording,
 * auto-model switching (intent + capability), and dispatches to the
 * appropriate API endpoint.
 */

import { resizeImage } from "../utils/imageResize.js";

export class Composer {
  constructor(deps) {
    this.deps = deps;
  }

  $id(s) {
    return this.deps.$(s);
  }

  autoResizeTextarea() {
    const ta = this.$id("promptInput");
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

  bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  updateSendButton() {
    const { $, state, icon } = this.deps;
    const btn = $("sendBtn");
    if (!btn) return;
    btn.disabled = !state.currentModel() && !state.sending;
    if (state.sending) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      btn.setAttribute("aria-label", "Stop generating");
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>';
      btn.setAttribute("aria-label", "Send message");
    }
  }

  render() {
    const { $, state, catalog, config, icon } = this.deps;
    this.updateSendButton();
    this.renderThinkingPills();

    const m = state.currentModel();
    const canImage = !!(m && (m.capabilities?.vision || m.capabilities?.ocr ||
      (catalog && catalog.pickModel && catalog.pickModel(state.provider, "ocr"))));
    const canAudio = !!(m && (m.capabilities?.audio || m.capabilities?.audio_transcription ||
      (catalog && catalog.pickModel && catalog.pickModel(state.provider, "transcription"))));

    const menuImage = $("menuImage"), menuAudio = $("menuAudio"),
      menuVoice = $("menuVoice"), menuTools = $("menuTools"),
      toolsCheck = $("menuToolsCheck");
    if (menuImage) menuImage.disabled = !canImage;
    if (menuAudio) menuAudio.disabled = !canAudio;
    if (menuVoice) menuVoice.disabled = false;
    if (menuTools) menuTools.disabled = !(m && m.capabilities?.function_calling);
    if (toolsCheck) {
      const hasTools = m && m.capabilities?.function_calling && state.autoTools;
      toolsCheck.innerHTML = hasTools ? icon("check_confirm") + " on" : "";
    }
  }

  renderThinkingPills() {
    const { $, state } = this.deps;
    const pills = $("thinkingPills");
    if (!pills) return;
    const level = state.thinkingEffort || "instant";
    pills.querySelectorAll(".thinking-pill").forEach((p) => {
      p.classList.toggle("active", p.dataset.level === level);
      p.setAttribute("aria-pressed", p.dataset.level === level ? "true" : "false");
    });
  }

  menuOpen() {
    const { $ } = this.deps;
    const menu = $("composerMenu");
    return menu && !menu.hidden;
  }

  toggleMenu(force) {
    const { $ } = this.deps;
    const menu = $("composerMenu");
    const btn = $("plusBtn");
    if (!menu) return;
    const show = typeof force === "boolean" ? force : menu.hidden;
    menu.hidden = !show;
    if (btn) btn.setAttribute("aria-expanded", String(show));
    this.render();
  }

  closeMenu() {
    this.toggleMenu(false);
  }

  async handleSend() {
    const { $, state, catalog, config, api, chat, settings, showToast, intentRouter, icon } = this.deps;

    if (state.sending) return;
    const text = $("promptInput").value.trim();
    let m = state.currentModel(); // snapshot for this whole turn

    if (!m) {
      settings.open();
      settings.showKeyStatus("err", "No models loaded. Check your provider in Settings.");
      return;
    }

    // Auto-switch to a capable model when attachments exceed current model's capabilities.
    if (state.pendingAudio && !m.capabilities?.audio_transcription) {
      const tid = catalog && catalog.pickModel ? catalog.pickModel(state.provider, "transcription") : null;
      const tm = state.models.find((x) => x.id === tid);
      if (tm) { state.setModel(tm.id); m = state.currentModel(); }
    }
    if (state.pendingImage && !m.capabilities?.vision && !m.capabilities?.ocr) {
      const vm = state.models.find((x) => x.capabilities?.vision || x.capabilities?.ocr);
      if (vm) { state.setModel(vm.id); m = state.currentModel(); }
    }

    // Client-side intent routing (fastText WASM — zero API calls).
    // Auto-switches to a capable model for TTS/image intent when confidence ≥ floor;
    // previous selection is restored when the turn ends.
    let revertModel = null;
    if (text && !state.pendingImage && !state.pendingAudio && intentRouter && intentRouter.ready) {
      const intent = intentRouter.route(text);
      const wantCap = intent.intent === "tts" ? "tts" : (intent.intent === "image" ? "vision" : null);
      if (wantCap && intent.confidence >= intentRouter.autoSwitchFloor) {
        const hasCap = wantCap === "vision"
          ? !!(m && (m.capabilities?.vision || m.capabilities?.ocr))
          : !!(m && m.capabilities && m.capabilities[wantCap]);
        if (!hasCap) {
          const pick = this.pickCapableModel(wantCap);
          if (pick && pick !== m.id) {
            revertModel = state.model;
            state.setModel(pick);
            m = state.currentModel();
          }
        }
      }
    }

    // No-key check — ollama and keyless custom providers with base URL are exempt.
    const hasKey = !!state.apiKey || state.provider === "ollama" ||
      (state.provider === "custom" && state.effectiveBase(state.provider));
    if (!hasKey) {
      settings.open();
      settings.showKeyStatus("err", "Add an API key for this provider to start chatting.");
      return;
    }

    if (!text && !state.pendingImage && !state.pendingAudio) return;

    state.sending = true;
    this.closeMenu();
    this.updateSendButton();

    const userMsg = { role: "user", content: text, modelUsed: m.id };
    if (state.pendingImage) {
      userMsg.imageDataUrl = state.pendingImage.dataUrl;
      if (state.pendingImage.tokenEstimate) userMsg.tokenEstimate = state.pendingImage.tokenEstimate;
    }
    if (state.pendingAudio) {
      userMsg.audioDataUrl = state.pendingAudio.dataUrl;
      if (state.pendingAudio.durationMs) userMsg.audioDurationMs = state.pendingAudio.durationMs;
    }
    state.messages.push(userMsg);
    state.saveMessages();

    const pendingImage = state.pendingImage;
    const pendingAudio = state.pendingAudio;
    state.pendingImage = null;
    state.pendingAudio = null;
    $("promptInput").value = "";
    this.autoResizeTextarea();
    chat.render();
    state.stickToBottom = true;

    const turn = chat.createAssistantTurn();
    chat.announce("Assistant is responding");

    try {
      let result;
      const endpoint = config.getEndpointType(m.capabilities || {});
      const callbacks = chat.buildStreamingCallbacks(turn);

      if (endpoint === "transcription" && pendingAudio) {
        const mid = catalog && catalog.pickModel ? catalog.pickModel(state.provider, "transcription") : m.id;
        result = { text: await api.callTranscription(turn, pendingAudio.dataUrl, mid, callbacks) };
      } else if (endpoint === "ocr" && pendingImage) {
        const mid = catalog && catalog.pickModel ? catalog.pickModel(state.provider, "ocr") : m.id;
        result = { text: await api.callOcr(turn, pendingImage.dataUrl, mid, callbacks) };
      } else if (endpoint === "tts") {
        const mid = (m.capabilities && m.capabilities.tts) ? m.id
          : (catalog && catalog.pickModel ? catalog.pickModel(state.provider, "tts") : m.id);
        const ttsResult = await api.callTts(turn, text, mid, callbacks);
        result = { text: ttsResult.text };
      } else if (endpoint === "embeddings") {
        const mid = catalog && catalog.pickModel ? catalog.pickModel(state.provider, "embeddings") : m.id;
        result = { text: await api.callEmbeddings(turn, text, mid, callbacks) };
      } else if (endpoint === "moderation") {
        const mid = catalog && catalog.pickModel ? catalog.pickModel(state.provider, "moderation") : m.id;
        result = { text: await api.callModeration(turn, text, mid, callbacks) };
      } else {
        result = await api.chatStreaming({ turn, text, image: pendingImage, audio: pendingAudio, model: m, callbacks });
      }

      chat.collapsePhase(turn);
      chat.finalizeTurn(turn, result, m);
      state.messages.push({ role: "assistant", content: result.text, modelUsed: m.id, toolUsed: result.toolUsed });
      state.saveMessages();
      chat.markMessagesRendered();
    } catch (err) {
      const isAbort = !!(err && err.name === "AbortError");
      if (turn && turn.row && turn.row.parentNode) turn.row.parentNode.removeChild(turn.row);
      if (isAbort) {
        chat.announce("Generation stopped");
      } else {
        state.messages.push({ role: "system", isError: true, content: (err.message || "Request failed.") });
        state.saveMessages();
        chat.render();
        chat.announce("Error: " + (err.message || "request failed"));
      }
    } finally {
      if (revertModel && state.model !== revertModel) { state.setModel(revertModel); }
      state.sending = false;
      this.render();
    }
  }

  pickCapableModel(wantCap) {
    const { state, catalog } = this.deps;
    if (wantCap === "vision") {
      const vm = state.models.find((x) => x.capabilities?.vision || x.capabilities?.ocr);
      return vm ? vm.id : null;
    }
    return catalog && catalog.pickModel ? catalog.pickModel(state.provider, "tts") : null;
  }

  handleFileSelected(kind) {
    const { $, state, api, chat, icon } = this.deps;
    const inputId = kind === "image" ? "imageInput" : "audioInput";
    const fileInput = $(inputId);
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result || "").split(",").pop() || "";
      if (kind === "image") {
        resizeImage(file).then(({ dataUrl, name, width, height }) => {
          const tokenEstimate = api.estimateImageTokens
            ? api.estimateImageTokens(width, height)
            : 0;
          state.pendingImage = { dataUrl, name, tokenEstimate };
        }).catch(() => {});
      } else {
        state.pendingAudio = { dataUrl: "data:" + (file.type || "audio/webm") + ";base64," + base64, name: file.name };
      }
      chat.render();
    };
    reader.readAsDataURL(file);
    if (fileInput) fileInput.value = "";
  }

  cancelAttachment(kind) {
    const { state, chat } = this.deps;
    if (kind === "image") { state.pendingImage = null; } else { state.pendingAudio = null; }
    chat.render();
  }

  initEvents() {
    const { $, state, api, composer, settings, voiceRecorder, showToast } = this.deps;

    const sendBtn = $("sendBtn");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        if (state.sending) {
          api.abortCurrentRequest();
        } else {
          this.handleSend();
        }
      });
    }

    const thinkingPills = $("thinkingPills");
    if (thinkingPills) {
      thinkingPills.addEventListener("click", (e) => {
        const pill = e.target.closest(".thinking-pill");
        if (!pill) return;
        state.thinkingEffort = pill.dataset.level;
        this.renderThinkingPills();
        if (pill.dataset.level === "high" && !state.messages.length) {
          showToast("High effort gives the model more time to reason — picks slower, deeper-capable models automatically.");
        }
      });
    }

    const plusBtn = $("plusBtn");
    if (plusBtn) plusBtn.addEventListener("click", (e) => { e.stopPropagation(); this.toggleMenu(); });

    const menuImage = $("menuImage");
    if (menuImage) menuImage.addEventListener("click", () => { this.closeMenu(); $("imageInput").click(); });
    const menuAudio = $("menuAudio");
    if (menuAudio) menuAudio.addEventListener("click", () => { this.closeMenu(); $("audioInput").click(); });

    if ($("menuVoice") && voiceRecorder) {
      $("menuVoice").addEventListener("click", () => {
        this.closeMenu();
        voiceRecorder.toggle();
      });
    }

    const menuTools = $("menuTools");
    if (menuTools) {
      menuTools.addEventListener("click", () => {
        if (menuTools.disabled) return;
        state.autoTools = !state.autoTools;
        this.render();
        this.toggleMenu(false);
      });
    }

    document.addEventListener("click", (e) => {
      if (this.menuOpen() && !e.target.closest(".composer-left")) this.closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.menuOpen()) this.closeMenu();
    });

    const promptInput = $("promptInput");
    if (promptInput) {
      promptInput.addEventListener("input", () => this.autoResizeTextarea());
      promptInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!state.sending) this.handleSend();
        }
      });
    }

    const imageInput = $("imageInput");
    if (imageInput) imageInput.addEventListener("change", () => this.handleFileSelected("image"));
    const audioInput = $("audioInput");
    if (audioInput) audioInput.addEventListener("change", () => this.handleFileSelected("audio"));

    document.addEventListener("paste", (e) => {
      if (!state.pendingImage && e.clipboardData && e.clipboardData.items) {
        for (const item of e.clipboardData.items) {
          if (item.type && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (!file) continue;
            e.preventDefault();
            resizeImage(file).then(({ dataUrl, width, height }) => {
              const tokenEstimate = api.estimateImageTokens
                ? api.estimateImageTokens(width, height)
                : 0;
              state.pendingImage = { dataUrl, name: "pasted-image.png", tokenEstimate };
              chat.render();
            }).catch(() => {});
            break;
          }
        }
      }
    });
  }
}
