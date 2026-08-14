/* ============================================================
   COMPOSER — prompt input, attach buttons, send button,
   demo-tools row, and all send flows (chat / transcription /
   OCR / TTS / embeddings / moderation).
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

function render(){
  $id("sendBtn").disabled = State.sending || !currentModel();
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
   SEND FLOWS
============================================================ */

async function handleSend(){
  if(State.sending) return;
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

  // No-key check (ollama and keyless custom with base URL are exempt)
  const hasKey = !!State.apiKey || State.provider === "ollama" ||
    (State.provider === "custom" && effectiveBase(State.provider));
  if(!hasKey){
    Settings.open();
    Settings.showKeyStatus("err", "Add an API key for this provider to start chatting.");
    return;
  }

  if(!text && !State.pendingImage && !State.pendingAudio) return;

  saveMessages();
  State.sending = true;
  closeMenu();
  $id("sendBtn").disabled = true;

  const userMsg = { role:"user", content:text, modelUsed:m.id };
  if(State.pendingImage) userMsg.imageDataUrl = State.pendingImage.dataUrl;
  if(State.pendingAudio) userMsg.audioDataUrl = State.pendingAudio.dataUrl;
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
      const mid = (window.Catalog && Catalog.pickModel(State.provider, "tts")) || m.id;
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
  } catch(err){
    State.messages.push({ role:"system", isError:true, content: "⚠ " + (err.message || "Request failed.") });
    saveMessages();
    Chat.render();
  } finally {
    State.sending = false;
    $id("sendBtn").disabled = false;
    render();
  }
}

async function handleDemoTool(demoId){
  const demo = Config.DEMO_TOOLS.find(d => d.id === demoId);
  if(!demo) return;
  const result = await Config.runDemoTool(demo, State.model);
  $id("demoOutput").innerHTML = result;
  $id("demoOutput").style.display = "block";
  $id("demoOutput").scrollIntoView({ behavior:"smooth", block:"nearest" });
  if(State.demoTimeout){ clearTimeout(State.demoTimeout); }
  State.demoTimeout = setTimeout(() => {
    $id("demoOutput").style.display = "none";
  }, 30000);
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
        State.pendingImage = { dataUrl, name: file.name };
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
  $id("sendBtn").addEventListener("click", handleSend);
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

  document.querySelectorAll(".demo-btn").forEach(btn => {
    btn.addEventListener("click", () => handleDemoTool(btn.dataset.demo));
  });

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
              State.pendingImage = { dataUrl: canvas.toDataURL("image/jpeg", 0.85), name: "pasted-image.png" };
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