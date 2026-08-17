(function(){

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

function updateSendButton(){
  const btn = $id("sendBtn");
  if(!btn) return;
  // Button must stay active while streaming so the user can stop the request.
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
  renderThinkingPills();
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
  if(toolsCheck) toolsCheck.innerHTML = (m && m.capabilities?.function_calling && State.autoTools) ? icon('check_confirm') + " on" : "";
}

function renderThinkingPills(){
  const pills = $id("thinkingPills");
  if(!pills) return;
  pills.querySelectorAll(".thinking-pill").forEach(p => {
    p.classList.toggle("active", p.dataset.level === (State.thinkingEffort || "instant"));
    p.setAttribute("aria-pressed", p.dataset.level === (State.thinkingEffort || "instant") ? "true" : "false");
  });
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

async function handleSend(){
  if(State.sending) return;
  const text = $id("promptInput").value.trim();
  let m = currentModel();   // snapshot for this whole turn

  if(!m){
    Settings.open();
    Settings.showKeyStatus("err", "No models loaded. Check your provider in Settings.");
    return;
  }

  // Auto-switch to a capable model when attachments exceed current model's capabilities.
  if(State.pendingAudio && !m.capabilities?.audio_transcription){
    const tid = (window.Catalog && Catalog.pickModel(State.provider, "transcription")) || null;
    const tm = State.models.find(x => x.id === tid);
    if(tm){ setModel(tm.id); m = currentModel(); }
  }
  if(State.pendingImage && !m.capabilities?.vision && !m.capabilities?.ocr){
    const vm = State.models.find(x => x.capabilities?.vision || x.capabilities?.ocr);
    if(vm){ setModel(vm.id); m = currentModel(); }
  }

  // Client-side intent routing (fastText WASM — zero API calls). Auto-switches
  // to a capable model for TTS/image intent when confidence ≥ floor; previous
  // selection is restored when the turn ends.
  let revertModel = null;
  if(text && !State.pendingImage && !State.pendingAudio && window.IntentRouter && window.IntentRouter.ready){
    const intent = window.IntentRouter.route(text);
    const wantCap = intent.intent === "tts" ? "tts" : (intent.intent === "image" ? "vision" : null);
    if(wantCap && intent.confidence >= window.IntentRouter.autoSwitchFloor){
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
    }
  }

  function pickCapableModel(wantCap){
    if(wantCap === "vision"){
      const vm = State.models.find(x => x.capabilities?.vision || x.capabilities?.ocr);
      return vm ? vm.id : null;
    }
    return (window.Catalog && Catalog.pickModel(State.provider, "tts")) || null;
  }

  // No-key check — ollama and keyless custom providers with base URL are exempt.
  const hasKey = !!State.apiKey || State.provider === "ollama" ||
    (State.provider === "custom" && effectiveBase(State.provider));
  if(!hasKey){
    Settings.open();
    Settings.showKeyStatus("err", "Add an API key for this provider to start chatting.");
    return;
  }

  if(!text && !State.pendingImage && !State.pendingAudio) return;

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
    Chat.markMessagesRendered();
  } catch(err){
    const isAbort = !!(err && err.name === "AbortError");
    if(turn && turn.row && turn.row.parentNode) turn.row.parentNode.removeChild(turn.row);
    if(isAbort){
      if(Chat.announce) Chat.announce("Generation stopped");
    } else {
      State.messages.push({ role:"system", isError:true, content: (err.message || "Request failed.") });
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

function initEvents(){
  $id("sendBtn").addEventListener("click", () => {
    if(State.sending){
      if(window.Api) Api.abortCurrentRequest();
    } else {
      handleSend();
    }
  });
  $id("thinkingPills").addEventListener("click", (e) => {
    const pill = e.target.closest(".thinking-pill");
    if(!pill) return;
    State.thinkingEffort = pill.dataset.level;
    renderThinkingPills();
    if(pill.dataset.level === "high" && !State.messages.length){
      hint("High effort gives the model more time to reason — picks slower, deeper-capable models automatically.");
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

window.Composer = {
  render,
  handleSend,
  initEvents,
  cancelAttachment,
  autoResizeTextarea
};

})();
