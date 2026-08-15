/* ============================================================
   COMPOSER — prompt input, attach buttons, send/stop button,
   and all send flows (chat / transcription / OCR / TTS /
   embeddings / moderation).
============================================================ */
(function(){

/* ============================================================
   HELPERS
============================================================ */

function $id(s){ return document.getElementById(s); }

function autoResizeTextarea(){
  const ta = $id("promptInput");
  if(!ta) return;
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
}

function bytesToBase64(bytes){
  let binary = "";
  const chunk = 0x8000;
  for(let i = 0; i < bytes.length; i += chunk){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/* ============================================================
   RENDERING
============================================================ */

function updateSendButton(){
  const btn = $id("sendBtn");
  if(!btn) return;
  // While streaming, the button must always be active so it can stop the request.
  btn.disabled = !currentModel() && !State.sending;
  if(State.sending){
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    btn.setAttribute("aria-label", "Stop generating");
  } else {
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>';
    btn.setAttribute("aria-label", "Send message");
  }
}

function render(){
  updateSendButton();
  const m = currentModel();
  const canImage = !!(m && (m.capabilities?.vision || m.capabilities?.ocr ||
    (window.Catalog && Catalog.pickModel(State.provider, "ocr"))));
  const canAudio = !!(m && (m.capabilities?.audio || m.capabilities?.audio_transcription ||
    (window.Catalog && Catalog.pickModel(State.provider, "transcription"))));
  const menuImage = $id("menuImage"), menuAudio = $id("menuAudio"),
        menuVoice = $id("menuVoice"), menuTools = $id("menuTools"),
        toolsCheck = $id("menuToolsCheck");
  if(menuImage) menuImage.disabled = !canImage;
  if(menuAudio) menuAudio.disabled = !canAudio;
  if(menuVoice) menuVoice.disabled = false;
  if(menuTools) menuTools.disabled = !(m && m.capabilities?.function_calling);
  if(toolsCheck) toolsCheck.textContent = (m && m.capabilities?.function_calling && State.autoTools) ? "✓ on" : "";
  renderIntentChip();
}

function menuOpen(){ const menu = $id("composerMenu"); return menu && !menu.hidden; }

function toggleMenu(force){
  const menu = $id("composerMenu"), btn = $id("plusBtn");
  if(!menu) return;
  const show = typeof force === "boolean" ? force : menu.hidden;
  menu.hidden = !show;
  if(btn) btn.setAttribute("aria-expanded", String(show));
  render();
}

function closeMenu(){ toggleMenu(false); }

/* ============================================================
   INTENT SUGGESTION CHIP

   When the intent classifier hears "tts" or "image" but lands below
   the confidence threshold, the message goes out as chat anyway —
   unless we surface a one-tap "use a capable model instead" hint so
   the fallback isn't silent. Shown for the current turn only: cleared
   on the next send, on dismissal, on a manual model change (the chip
   re-validates in render()), or when the target model disappears.
============================================================ */

let intentChip = null;   // { intent: "tts"|"image", pickId }

function intentChipModelName(pickId){
  const mm = State.models.find(x => x.id === pickId);
  return (mm && mm.name) ? mm.name : pickId;
}

function showIntentChip(intent, pickId){
  intentChip = { intent, pickId };
  renderIntentChip();
}

function hideIntentChip(){
  intentChip = null;
  const row = $id("intentChipRow");
  if(row) row.hidden = true;
}

function renderIntentChip(){
  const row = $id("intentChipRow");
  if(!row) return;
  if(!intentChip){
    row.hidden = true;
    return;
  }
  // Re-validate: if the user already switched to a capable model (e.g.
  // via the model pill) or the offered model no longer exists, the hint
  // is moot — hide it instead of offering a no-op button.
  const m = currentModel();
  const wantCap = intentChip.intent === "tts" ? "tts" : "vision";
  const hasCap = wantCap === "vision"
    ? !!(m && (m.capabilities?.vision || m.capabilities?.ocr))
    : !!(m && m.capabilities && m.capabilities[wantCap]);
  if(hasCap || !State.models.find(x => x.id === intentChip.pickId)){
    row.hidden = true;
    return;
  }
  const text = $id("intentChipText"), act = $id("intentChipAction");
  if(text) text.textContent = intentChip.intent === "tts"
    ? "Sounded like speech — send as TTS?"
    : "Sounded like an image request — use a vision model?";
  if(act) act.textContent = "Use " + intentChipModelName(intentChip.pickId);
  row.hidden = false;
}

/* ============================================================
   SEND FLOWS
============================================================ */

async function handleSend(){
  if(State.sending) return;
  hideIntentChip();   // the previous suggestion expires on the next message
  const text = $id("promptInput").value.trim();
  let m = currentModel();   // snapshot for this whole turn

  if(!m){
    Settings.open();
    Settings.showKeyStatus("err", "No models loaded. Check your provider in Settings.");
    return;
  }

  // Attachments on a model that can't handle them: auto-switch to a capable one.
  if(State.pendingAudio && !m.capabilities?.audio_transcription){
    const tid = (window.Catalog && Catalog.pickModel(State.provider, "transcription")) || null;
    const tm = State.models.find(x => x.id === tid);
    if(tm){ setModel(tm.id); m = currentModel(); }
  }
  if(State.pendingImage && !m.capabilities?.vision && !m.capabilities?.ocr){
    const vm = State.models.find(x => x.capabilities?.vision || x.capabilities?.ocr);
    if(vm){ setModel(vm.id); m = currentModel(); }
  }

  // Client-side intent routing (fastText WASM — zero API calls). When the
  // message clearly asks for speech ("make this talk") or image analysis
  // and the selected model can't do it, temporarily switch to a capable
  // model for this turn only; the previous selection is restored when the
  // turn ends. Explicit attachments always win over the classifier, and a
  // still-loading classifier or a provider without a capable model is a
  // silent no-op (the message is sent to the current model as chat).
  // A below-threshold tts/image reading instead surfaces a one-tap
  // suggestion chip (see INTENT SUGGESTION CHIP) so the fallback to
  // chat isn't silent — set after the no-key check so an early return
  // can't leave a stale hint behind.
  // Best capable model for an intent, or null when the provider has none.
  function pickCapableModel(wantCap){
    if(wantCap === "vision"){
      const vm = State.models.find(x => x.capabilities?.vision || x.capabilities?.ocr);
      return vm ? vm.id : null;
    }
    return (window.Catalog && Catalog.pickModel(State.provider, "tts")) || null;
  }

  let revertModel = null;
  let chipOffer = null;
  if(text && !State.pendingImage && !State.pendingAudio && window.IntentRouter && window.IntentRouter.ready){    const intent = window.IntentRouter.route(text);
    const wantCap = intent.intent === "tts" ? "tts" : (intent.intent === "image" ? "vision" : null);
    if(intent.isConfident && wantCap){
      const hasCap = wantCap === "vision"
        ? !!(m && (m.capabilities?.vision || m.capabilities?.ocr))
        : !!(m && m.capabilities && m.capabilities[wantCap]);
      if(!hasCap){
        const pick = pickCapableModel(wantCap);
        if(pick && pick !== m.id){
          revertModel = State.model;
          setModel(pick);
          m = currentModel();
        }
      }
    } else if(!intent.isConfident && wantCap){
      // Heard "tts"/"image" below the threshold — the message will be
      // sent as chat, but offer a one-tap recovery instead of a silent
      // fallback. The chip also re-validates in render(), so a manual
      // model change or dismiss clears it.
      const hasCap = wantCap === "vision"
        ? !!(m && (m.capabilities?.vision || m.capabilities?.ocr))
        : !!(m && m.capabilities && m.capabilities[wantCap]);
      if(!hasCap){
        const pick = pickCapableModel(wantCap);
        if(pick && pick !== m.id) chipOffer = { intent: intent.intent, pickId: pick };
      }
    }
  }

  // Best capable model for an intent, or null when the provider has none.
  function pickCapableModel(wantCap){
    if(wantCap === "vision"){
      const vm = State.models.find(x => x.capabilities?.vision || x.capabilities?.ocr);
      return vm ? vm.id : null;
    }
    return (window.Catalog && Catalog.pickModel(State.provider, "tts")) || null;
  }

  // No-key check (ollama and keyless custom with base URL are exempt)
  const hasKey = !!State.apiKey || State.provider === "ollama" ||
    (State.provider === "custom" && effectiveBase(State.provider));
  if(!hasKey){
    Settings.open();
    Settings.showKeyStatus("err", "Add an API key for this provider to start chatting.");
    return;
  }

  if(!text && !State.pendingImage && !State.pendingAudio) return;

  if(chipOffer) showIntentChip(chipOffer.intent, chipOffer.pickId);

  State.sending = true;
  closeMenu();
  updateSendButton();

  const userMsg = { role:"user", content:text, modelUsed:m.id };
  if(State.pendingImage) userMsg.imageDataUrl = State.pendingImage.dataUrl;
  if(State.pendingImage && State.pendingImage.tokenEstimate) userMsg.tokenEstimate = State.pendingImage.tokenEstimate;
  if(State.pendingAudio){
    userMsg.audioDataUrl = State.pendingAudio.dataUrl;
    if(State.pendingAudio.durationMs) userMsg.audioDurationMs = State.pendingAudio.durationMs;
  }
  State.messages.push(userMsg);
  saveMessages();

  const pendingImage = State.pendingImage;
  const pendingAudio = State.pendingAudio;
  State.pendingImage = null;
  State.pendingAudio = null;
  $id("promptInput").value = "";
  autoResizeTextarea();
  Chat.render();
  State.stickToBottom = true;

  const turn = Chat.createAssistantTurn();
  if(Chat.announce) Chat.announce("Assistant is responding");

  try{
    let result;
    const endpoint = Config.getEndpointType(m.capabilities || {});

    if(endpoint === "transcription" && pendingAudio){
      const mid = (window.Catalog && Catalog.pickModel(State.provider, "transcription")) || m.id;
      result = { text: await Api.callTranscriptionStreaming(turn, pendingAudio.dataUrl, mid) };
    } else if(endpoint === "ocr" && pendingImage){
      const mid = (window.Catalog && Catalog.pickModel(State.provider, "ocr")) || m.id;
      result = { text: await Api.callOcrStreaming(turn, pendingImage.dataUrl, mid) };
    } else if(endpoint === "tts"){
      // Use the user's selected TTS model; fall back to an auto-pick only
      // when the selection lacks tts capabilities (custom/unknown models).
      const mid = (m.capabilities && m.capabilities.tts) ? m.id
        : ((window.Catalog && Catalog.pickModel(State.provider, "tts")) || m.id);
      result = await Api.callTtsStreaming(turn, text, mid);
    } else if(endpoint === "embeddings"){
      const mid = (window.Catalog && Catalog.pickModel(State.provider, "embeddings")) || m.id;
      result = await Api.callEmbeddingsStreaming(turn, text, mid);
    } else if(endpoint === "moderation"){
      const mid = (window.Catalog && Catalog.pickModel(State.provider, "moderation")) || m.id;
      result = await Api.callModerationStreaming(turn, text, mid);
    } else {
      result = await Api.callChatStreaming(turn, text, pendingImage, pendingAudio, m);
    }

    Chat.collapsePhase(turn);
    Chat.finalizeTurn(turn, result, m);
    State.messages.push({ role:"assistant", content: result.text, modelUsed: m.id, toolUsed: result.toolUsed });
    saveMessages();
    Chat.markMessagesRendered();   // turn row already in DOM — don't re-render it
  } catch(err){
    const isAbort = !!(err && err.name === "AbortError");
    // Remove the empty assistant bubble so no ghost turn is left behind.
    if(turn && turn.row && turn.row.parentNode) turn.row.parentNode.removeChild(turn.row);
    if(isAbort){
      if(Chat.announce) Chat.announce("Generation stopped");
    } else {
      State.messages.push({ role:"system", isError:true, content: "⚠ " + (err.message || "Request failed.") });
      saveMessages();
      Chat.render();
      if(Chat.announce) Chat.announce("Error: " + (err.message || "request failed"));
    }
  } finally {
    if(revertModel && State.model !== revertModel){ setModel(revertModel); }
    State.sending = false;
    render();
  }
}

function handleFileSelected(kind){
  const inputId = kind === "image" ? "imageInput" : "audioInput";
  const fileInput = $id(inputId);
  const file = fileInput && fileInput.files && fileInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = (reader.result || "").split(",").pop() || "";
    if(kind === "image"){
      const img = new Image();
      img.onload = () => {
        const maxDim = 1024;
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const tokenEstimate = (window.Api && Api.estimateImageTokens) ? Api.estimateImageTokens(width, height) : 0;
        State.pendingImage = { dataUrl, name: file.name, tokenEstimate };
      };
      img.src = "data:" + file.type + ";base64," + base64;
    } else {
      State.pendingAudio = { dataUrl: "data:" + (file.type || "audio/webm") + ";base64," + base64, name: file.name };
    }
    Chat.render();
  };
  reader.readAsDataURL(file);
  if(fileInput) fileInput.value = "";
}

function cancelAttachment(kind){
  if(kind === "image"){ State.pendingImage = null; } else { State.pendingAudio = null; }
  Chat.render();
}

/* ============================================================
   EVENTS
============================================================ */

function initEvents(){
  $id("sendBtn").addEventListener("click", () => {
    if(State.sending){
      if(window.Api) Api.abortCurrentRequest();
    } else {
      handleSend();
    }
  });
  $id("plusBtn").addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });

  $id("menuImage").addEventListener("click", () => { closeMenu(); $id("imageInput").click(); });
  $id("menuAudio").addEventListener("click", () => { closeMenu(); $id("audioInput").click(); });
  $id("menuVoice").addEventListener("click", () => {
    closeMenu();
    if(window.VoiceRecorder) VoiceRecorder.toggle();
  });
  $id("menuTools").addEventListener("click", () => {
    if($id("menuTools").disabled) return;
    State.autoTools = !State.autoTools;
    render();
    toggleMenu(false);
  });

  document.addEventListener("click", (e) => {
    if(menuOpen() && !e.target.closest(".composer-left")) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape" && menuOpen()) closeMenu();
  });
  $id("promptInput").addEventListener("input", autoResizeTextarea);
  $id("promptInput").addEventListener("keydown", (e) => {
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      if(!State.sending) handleSend();
    }
  });
  $id("imageInput").addEventListener("change", () => handleFileSelected("image"));
  $id("audioInput").addEventListener("change", () => handleFileSelected("audio"));

  const chipAction = $id("intentChipAction"), chipDismiss = $id("intentChipDismiss");
  if(chipAction) chipAction.addEventListener("click", () => {
    const c = intentChip;
    if(c && State.models.find(x => x.id === c.pickId)) setModel(c.pickId);
    hideIntentChip();
  });
  if(chipDismiss) chipDismiss.addEventListener("click", hideIntentChip);

  document.addEventListener("paste", (e) => {
    if(!State.pendingImage && e.clipboardData && e.clipboardData.items){
      for(const item of e.clipboardData.items){
        if(item.type && item.type.startsWith("image/")){
          const file = item.getAsFile();
          if(!file) continue;
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result || "").split(",").pop() || "";
            const img = new Image();
            img.onload = () => {
              const maxDim = 1024;
              let { width, height } = img;
              if(width > maxDim || height > maxDim){
                const scale = maxDim / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
              }
              const canvas = document.createElement("canvas");
              canvas.width = width;
              canvas.height = height;
              canvas.getContext("2d").drawImage(img, 0, 0, width, height);
              const tokenEstimate = (window.Api && Api.estimateImageTokens) ? Api.estimateImageTokens(width, height) : 0;
              State.pendingImage = { dataUrl: canvas.toDataURL("image/jpeg", 0.85), name: "pasted-image.png", tokenEstimate };
              Chat.render();
            };
            img.src = "data:" + item.type + ";base64," + base64;
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  });
}

// Expose globally
window.Composer = {
  render,
  handleSend,
  initEvents,
  cancelAttachment,
  autoResizeTextarea
};

})();