/**
 * VoiceRecorder — records audio from the microphone and attaches it
 * to the pending audio state for the current chat turn.
 */

export class VoiceRecorder {
  constructor(deps) {
    this.deps = deps;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = null;
    this.timerInterval = null;
    this.recordedMs = 0;
  }

  renderTimer() {
    if (!this.startTime) return;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const seconds = (elapsed % 60).toString().padStart(2, "0");
    const { $ } = this.deps;
    const el = $("recTime");
    if (el) el.textContent = `${minutes}:${seconds}`;
  }

  async startRecording() {
    const { $, state, showToast } = this.deps;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      const recordMimeType = this.mediaRecorder.mimeType || "audio/webm";
      const recordExtension = recordMimeType === "audio/webm" ? ".webm" : recordMimeType === "audio/mp4" ? ".m4a" : ".webm";
      this.audioChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: recordMimeType });
        const reader = new FileReader();
        reader.onload = () => {
          state.pendingAudio = {
            name: `Recording ${new Date().toLocaleString()}${recordExtension}`,
            dataUrl: reader.result,
            durationMs: this.recordedMs || 0
          };
          // Notify subscribers that pending media changed
          const composer = this.deps.composer;
          if (composer && typeof composer.render === "function") composer.render();
        };
        reader.readAsDataURL(audioBlob);
      };

      this.mediaRecorder.start();
      const overlay = $("voiceOverlay");
      if (overlay) overlay.style.display = "flex";
      this.timerInterval = setInterval(() => this.renderTimer(), 1000);
      this.renderTimer();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      const overlay = $("voiceOverlay");
      if (overlay) {
        overlay.style.display = "flex";
        overlay.querySelectorAll(".voice-error").forEach((el) => el.remove());
        const errorElement = document.createElement("div");
        errorElement.className = "voice-error";
        errorElement.style.cssText = "padding:12px;color:#fff;background:rgba(200,0,0,.35);border-radius:8px;margin:12px;text-align:center;";
        errorElement.textContent = "Could not access microphone. Please check permissions.";
        overlay.appendChild(errorElement);
        setTimeout(() => { errorElement.remove(); }, 5000);
      }
    }
  }

  stopRecording() {
    const { $ } = this.deps;
    if (!this.mediaRecorder) return;

    this.recordedMs = Date.now() - this.startTime;
    this.mediaRecorder.stop();
    this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    this.mediaRecorder = null;
    clearInterval(this.timerInterval);
    const overlay = $("voiceOverlay");
    if (overlay) overlay.style.display = "none";
  }

  toggle() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  initEvents() {
    const { $ } = this.deps;
    const cancelBtn = $("cancelRecording");
    if (cancelBtn) cancelBtn.addEventListener("click", () => {
      this.stopRecording();
      this.audioChunks = [];
    });

    const stopBtn = $("stopRecording");
    if (stopBtn) stopBtn.addEventListener("click", () => this.stopRecording());
  }
}
