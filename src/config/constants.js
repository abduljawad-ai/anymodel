/**
 * Application constants: localStorage keys, defaults, provider color palette.
 */

// ── localStorage keys ────────────────────────────────────────────────
export const LS_PROVIDER    = "anymodel_provider_v1";
export const LS_KEYS        = "anymodel_keys_v1";
export const LS_BASES       = "anymodel_bases_v1";
export const LS_MODEL_PREFIX = "anymodel_model_";
export const LS_SYS         = "anymodel_sysprompt_v1";
export const LS_MESSAGES    = "anymodel_messages_v1";
export const LS_SESSIONS    = "anymodel_sessions_v1";
export const LS_ACTIVE      = "anymodel_active_session_v1";
export const LS_TTS_VOICE   = "anymodel_tts_voice_v1";
export const LS_THEME       = "anymodel_theme_v1";

// ── Defaults ─────────────────────────────────────────────────────────
export const DEFAULT_PROVIDER = "openai";

// ── Accent colors per provider (header swatch) ───────────────────────
export const PROVIDER_COLORS = {
  openai:    "#10A37F",
  anthropic: "#D97757",
  google:    "#4285F4",
  mistral:   "#FF7000",
  groq:      "#F55036",
  deepseek:  "#4D6BFE",
  xai:       "#141414",
  meta:      "#0668E1",
  openrouter:"#FF7A00",
  ollama:    "#8A5CF8",
  custom:    "#8A5CF8"
};

// ── Request timeouts (ms) ────────────────────────────────────────────
export const REQUEST_TIMEOUT_MS  = 120000;  // 2 min
export const MEDIA_TIMEOUT_MS    = 300000;  // 5 min
export const MODELS_TIMEOUT_MS   = 300000;  // 5 min
