import { FastText, addOnPostRun } from "../fasttext.js";

const MODEL_URL = "intent_model.ftz";
const THRESHOLD = 0.65;
const AUTO_SWITCH_FLOOR = 0.45;
const LABELS = new Set(["chat", "tts", "image", "transcription"]);

const DEFAULT_HINT = "Enter to send · Shift+Enter for new line";
const LOADING_HINT = "Loading AI classifier…";

// Self-tests mirror acceptance cases in train_model.py so training and browser are gated on the same bar
const SELF_TESTS = [
  { text: "make this talk",        expect: "tts",           min: 0.80 },
  { text: "crea una imagen",       expect: "image",         min: 0.70 },
  { text: "explain physics",       expect: "chat",          min: 0.80 },
  { text: "genrate audo",          expect: "tts",           min: 0.65 },
  { text: "transcribe this audio", expect: "transcription", min: 0.65 },
  { text: "generate speech of this text", expect: "tts",    min: 0.65 },
  { text: "summarize this text",   expect: "chat",          min: 0.65 },
];

// Only swaps hint while it still shows default text; restored by Header.render() once loading finishes
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
    this.autoSwitchFloor = AUTO_SWITCH_FLOOR;
    this.labels = LABELS;
    this.model = null;
    this.ready = false;
    this.loading = false;
    this.error = null;
    this.selfTests = [];
  }

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
      if(window.Header && window.Header.render) Header.render();
    }
  }

  // Unknown labels and unloaded model fall back to "chat" with isConfident: false.
  // Known labels below threshold keep detected intent with isConfident: false
  // so caller can still auto-switch via autoSwitchFloor.
  classify(text){
    if(!this.model || !text || !text.trim()){
      return { intent: "chat", confidence: 0, isConfident: false };
    }
    try{
      const preds = this.model.predict(text.trim(), 1, 0.0);
      const top = (preds && preds.size && preds.size() > 0) ? preds.get(0) : null;
      if(!top) return { intent: "chat", confidence: 0, isConfident: false };

      // embind binds std::pair<float,string> as [prob, label]; also accept {label, prob} objects
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

const router = new IntentRouter();
window.IntentRouter = router;
router.load();
