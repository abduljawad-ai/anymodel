(function(){

  const BAR_COUNT = 28;
  const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

  let current = null;
  let sharedCtx = null;

  function ctx(){
    if(!sharedCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC) sharedCtx = new AC();
    }
    return sharedCtx;
  }

  // Deterministic placeholder bars shown while the real waveform decodes.
  function placeholderBars(){
    const bars = [];
    let seed = 7;
    for(let i = 0; i < BAR_COUNT; i++){
      seed = (seed * 9301 + 49297) % 233280;
      bars.push(0.25 + (seed / 233280) * 0.75);
    }
    return bars;
  }

  function formatDuration(sec){
    if(!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function dataUrlToBytes(src){
    if(typeof src !== "string" || src.indexOf("data:") !== 0) return null;
    const comma = src.indexOf(",");
    if(comma < 0) return null;
    const meta = src.slice(5, comma).toLowerCase();
    if(meta.indexOf("base64") === -1) return null;
    try{
      const bin = atob(src.slice(comma + 1));
      const bytes = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }catch(e){ return null; }
  }

  // Decode audio into [0..1] amplitude bars. Uses raw bytes when available
  // (CSP-safe for blob:/data: URLs); falls back to fetch() for http(s).
  async function decodeWaveform(src, raw, count){
    const ac = ctx();
    try{
      let buf = raw || null;
      if(!buf && typeof src === "string"){
        if(src.indexOf("http") === 0){
          const res = await fetch(src);
          buf = await res.arrayBuffer();
        } else {
          buf = dataUrlToBytes(src);
        }
      }
      if(!buf) return null;
      if(buf instanceof Blob) buf = await buf.arrayBuffer();
      if(!ac) return null;
      const audioBuf = await ac.decodeAudioData(buf.slice(0));
      const data = audioBuf.getChannelData(0);
      const per = Math.max(1, Math.floor(data.length / count));
      const out = [];
      for(let i = 0; i < count; i++){
        let peak = 0;
        for(let j = 0; j < per; j++){
          const v = Math.abs(data[i * per + j] || 0);
          if(v > peak) peak = v;
        }
        out.push(Math.min(1, Math.max(0.08, peak * 1.6)));
      }
      return out;
    }catch(e){
      return null;
    }
  }

  function stopCurrent(){
    if(!current) return;
    const c = current;
    current = null;
    if(c.audio){
      c.audio.pause();
      try{ c.audio.currentTime = 0; }catch(e){}
    }
    c.cap.classList.remove("playing");
    c.playBtn.innerHTML = PLAY_ICON;
    c.playBtn.setAttribute("aria-label", "Play voice message");
  }

  // Build a capsule into `container`.
  // Options: { src, raw, durationMs, text }
  function build(container, opts){
    if (typeof document === 'undefined') return;
    const src = opts && opts.src;
    if(!src) return;
    container.innerHTML = "";

    const cap = document.createElement("div");
    cap.className = "voice-capsule";
    cap.setAttribute("role", "group");
    cap.setAttribute("aria-label", "Voice message" + (opts && opts.text ? ": " + opts.text : ""));

    const playBtn = document.createElement("button");
    playBtn.className = "voice-play";
    playBtn.type = "button";
    playBtn.setAttribute("aria-label", "Play voice message");
    playBtn.innerHTML = PLAY_ICON;

    const wave = document.createElement("div");
    wave.className = "voice-wave";

    const dur = document.createElement("span");
    dur.className = "voice-dur";
    dur.textContent = formatDuration((opts && opts.durationMs ? opts.durationMs : 0) / 1000);

    cap.appendChild(playBtn);
    cap.appendChild(wave);
    cap.appendChild(dur);
    container.appendChild(cap);

    let audio = null;
    let liveDur = (opts && opts.durationMs ? opts.durationMs : 0) / 1000;
    let loaded = false;

    function paint(bars){
      wave.innerHTML = "";
      for(const h of bars){
        const b = document.createElement("span");
        b.className = "voice-bar";
        b.style.height = Math.round(h * 100) + "%";
        wave.appendChild(b);
      }
    }

    paint(placeholderBars());

    async function load(){
      if(loaded) return;
      loaded = true;
      const wb = await decodeWaveform(src, opts && opts.raw, BAR_COUNT);
      if(wb) paint(wb);
      audio = new Audio(src);
      audio.addEventListener("loadedmetadata", () => {
        if(isFinite(audio.duration) && audio.duration > 0){
          liveDur = audio.duration;
          dur.textContent = formatDuration(liveDur);
        }
      });
      audio.addEventListener("ended", () => {
        stopCurrent();
      });
    }
    load();

    playBtn.addEventListener("click", () => {
      if(cap.classList.contains("playing")){
        stopCurrent();
        return;
      }
      stopCurrent();
      if(!audio) audio = new Audio(src);
      current = { audio, cap, playBtn };
      cap.classList.add("playing");
      playBtn.innerHTML = PAUSE_ICON;
      playBtn.setAttribute("aria-label", "Pause voice message");
      audio.play().catch(() => {
        stopCurrent();
      });
    });

    return cap;
  }

  window.VoiceCapsule = { build, stopCurrent };
})();
