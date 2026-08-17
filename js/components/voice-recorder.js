(function(){

  let mediaRecorder = null;
  let audioChunks = [];
  let startTime = null;
  let timerInterval = null;
  let recordedMs = 0;

  function renderTimer(){
    if(!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const seconds = (elapsed % 60).toString().padStart(2, "0");
    $("recTime").textContent = `${minutes}:${seconds}`;
  }

  async function startRecording(){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      const recordMimeType = mediaRecorder.mimeType || "audio/webm";
      const recordExtension = recordMimeType === "audio/webm" ? ".webm" : recordMimeType === "audio/mp4" ? ".m4a" : ".webm";
      audioChunks = [];
      startTime = Date.now();

      mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: recordMimeType });
        const reader = new FileReader();
        reader.onload = () => {
          State.pendingAudio = { name: `Recording ${new Date().toLocaleString()}${recordExtension}`, dataUrl: reader.result, durationMs: recordedMs || 0 };
          Composer.render();
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      $("voiceOverlay").style.display = "flex";
      timerInterval = setInterval(renderTimer, 1000);
      renderTimer();
    } catch(err){
      console.error("Error accessing microphone:", err);
      $("voiceOverlay").style.display = "flex";
      $("voiceOverlay").querySelectorAll(".voice-error").forEach(el => el.remove());
      const errorElement = document.createElement("div");
      errorElement.className = "voice-error";
      errorElement.style.cssText = "padding:12px;color:#fff;background:rgba(200,0,0,.35);border-radius:8px;margin:12px;text-align:center;";
      errorElement.textContent = "Could not access microphone. Please check permissions.";
      $("voiceOverlay").appendChild(errorElement);
      setTimeout(() => {
        errorElement.remove();
      }, 5000);
    }
  }

  function stopRecording(){
    if(!mediaRecorder) return;

    recordedMs = Date.now() - startTime;
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    mediaRecorder = null;
    clearInterval(timerInterval);
    $("voiceOverlay").style.display = "none";
  }

  function toggle(){
    if(mediaRecorder && mediaRecorder.state === "recording"){
      stopRecording();
    } else {
      startRecording();
    }
  }

  function initEvents(){
    $("cancelRecording").addEventListener("click", () => {
      stopRecording();
      audioChunks = [];
    });

    $("stopRecording").addEventListener("click", stopRecording);
  }

  window.VoiceRecorder = {
    toggle,
    initEvents
  };
})();
