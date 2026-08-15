/* ============================================================
   INTENT ROUTER — client-side intent classification.

   Uses the official fastText WebAssembly build (fasttext.js +
   fasttext_wasm.js + fasttext_wasm.wasm, all from the fastText
   repo's webassembly/ folder) and the quantized model trained by
   train_model.py (intent_model.ftz). Everything runs in the
   browser — routing costs zero API requests.

   Exposes a global singleton on `window.IntentRouter`:
     - ready:        true once the model is loaded
     - loading:      true while the model downloads/compiles
     - error:        the load error, if any
     - classify(text) -> { intent, confidence, isConfident }
     - route(text)    -> classify + { originalMessage, content }
     - selfTests      -> results of the on-load self-tests

   Confidence threshold: an unknown label (or a model that isn't
   loaded) falls back to "chat" with isConfident: false, while a
   known label below the threshold keeps its detected intent with
   isConfident: false and its raw confidence — the composer uses
   autoSwitchFloor (0.45) to decide whether to auto-switch models,
   so detections that are merely "not confident" still route
   automatically instead of falling back to chat.
============================================================ */

import { FastText, addOnPostRun } from "../fasttext.js";

const MODEL_URL = "intent_model.ftz";
const THRESHOLD = 0.65;          // "confident" marker (self-tests, isConfident)
const AUTO_SWITCH_FLOOR = 0.45;  // minimum confidence to auto-switch models
const LABELS = new Set(["chat", "tts", "image", "transcription"]);

const DEFAULT_HINT = "Enter to send · Shift+Enter for new line";
const LOADING_HINT = "Loading AI classifier…";

/* Self-tests that run automatically once the model is loaded. These
   mirror the acceptance cases in train_model.py so the training
   pipeline and the browser are gated on the same bar. */
const SELF_TESTS = [
  { text: "make this talk",        expect: "tts",           min: 0.80 },
  { text: "crea una imagen",       expect: "image",         min: 0.70 },
  { text: "explain physics",       expect: "chat",          min: 0.80 },
  { text: "genrate audo",          expect: "tts",           min: 0.65 },  // typo tolerance
  { text: "transcribe this audio", expect: "transcription", min: 0.65 },
  { text: "generate speech of this text", expect: "tts",    min: 0.65 },  // low-threshold phrasing
  { text: "summarize this text",   expect: "chat",          min: 0.65 },  // must NOT drift to image
];

/* Show the loading state in the composer hint line on first visit.
   Only swaps the hint while it still shows the default text, so a
   model-specific hint (TTS/transcription placeholders) is never
   clobbered. Restored by Header.render() once loading finishes. */
function setLoadingHint(on){
  const el = document.getElementById("composerHint");
  if(!el) return;
  if(on){
    if(el.textContent === DEFAULT_HINT) el.textContent = LOADING_HINT;
  } else {
    if(el.textContent === LOADING_HINT) el.textContent = DEFAULT_HINT;
  }
}

class IntentRouter {
  constructor(){
    this.threshold = THRESHOLD;
    this.autoSwitchFloor = AUTO_SWITCH_FLOOR;   // caller gate for auto-switching
    this.labels = LABELS;
    this.model = null;
    this.ready = false;
    this.loading = false;
    this.error = null;
    this.selfTests = [];
  }

  /* Load the model once. Resolves when ready; safe to call any time. */
  async load(modelUrl = MODEL_URL){
    if(this.loading || this.ready) return;
    this.loading = true;
    setLoadingHint(true);
    try{
      const ft = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Timed out waiting for the fastText WASM runtime.")),
          30000
        );
        addOnPostRun(() => { clearTimeout(timer); resolve(new FastText()); });
      });
      this.model = await ft.loadModel(modelUrl);
      this.ready = true;
      this.selfTests = this.runSelfTests();
      console.info(
        `[intent-router] model loaded — self-tests: ` +
        `${this.selfTests.filter(t => t.pass).length}/${this.selfTests.length} passed`
      );
    }catch(err){
      this.error = err;
      console.error("[intent-router] failed to load the intent classifier:", err);
    }finally{
      this.loading = false;
      setLoadingHint(false);
      // Restore the model-appropriate hint (Header.render recomputes it).
      if(window.Header && window.Header.render) Header.render();
    }
  }

  /* Classify a message. Returns { intent, confidence, isConfident }.
     Unknown labels (and a model that isn't loaded yet) fall back to
     "chat" with isConfident: false. A known label below the threshold
     keeps its detected intent and confidence with isConfident: false,
     so the caller can still auto-switch on it (see autoSwitchFloor)
     instead of silently treating it as chat. Never throws. */
  classify(text){
    if(!this.model || !text || !text.trim()){
      return { intent: "chat", confidence: 0, isConfident: false };
    }
    try{
      const preds = this.model.predict(text.trim(), 1, 0.0);
      const top = (preds && preds.size && preds.size() > 0) ? preds.get(0) : null;
      if(!top) return { intent: "chat", confidence: 0, isConfident: false };

      // embind binds std::pair<float,string> as a JS array [prob, label].
      // Accept {label, prob} objects too for forward compatibility.
      const isArr = Array.isArray(top);
      const rawLabel = isArr ? top[1] : (top.label !== undefined ? top.label : top[1]);
      const rawProb = isArr ? top[0] : (top.prob !== undefined ? top.prob : top[0]);
      const confidence = (typeof rawProb === "number" && isFinite(rawProb)) ? rawProb : 0;
      const intent = String(rawLabel || "").replace(/^__label__/, "");

      if(!this.labels.has(intent)){
        return { intent: "chat", confidence, isConfident: false };
      }
      if(confidence < this.threshold){
        return { intent, confidence, isConfident: false };
      }
      return { intent, confidence, isConfident: true };
    }catch(err){
      console.error("[intent-router] classify failed:", err);
      return { intent: "chat", confidence: 0, isConfident: false };
    }
  }

  route(userMessage){
    const result = this.classify(userMessage);
    return { ...result, originalMessage: userMessage, content: userMessage };
  }

  /* Run the on-load self-tests and record the results. */
  runSelfTests(){
    const results = SELF_TESTS.map(t => {
      const r = this.classify(t.text);
      const pass = r.isConfident && r.intent === t.expect && r.confidence >= t.min;
      console.log(
        `[intent-router] ${pass ? "PASS" : "FAIL"} ` +
        `${JSON.stringify(t.text)} -> ${r.intent} (${r.confidence.toFixed(3)}) ` +
        `want ${t.expect} >= ${t.min}`
      );
      return { text: t.text, expected: t.expect, min: t.min, intent: r.intent, confidence: r.confidence, pass };
    });
    const passed = results.filter(r => r.pass).length;
    console.info(
      `[intent-router] self-tests ${passed === results.length ? "passed" : "FAILED"} (${passed}/${results.length})`
    );
    return results;
  }
}

/* Module scripts run after the DOM is parsed, so the element the
   loading hint touches already exists. Kick the load off immediately. */
const router = new IntentRouter();
window.IntentRouter = router;
router.load();
