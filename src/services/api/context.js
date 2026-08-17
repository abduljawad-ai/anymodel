/**
 * Context selection: token estimation, context-window budgeting, and
 * truncation logic. Pure functions — no global state access.
 */

import { getContextWindow } from "../../config/capabilities.js";

// ── Constants ─────────────────────────────────────────────────────────
const TOKEN_CHARS = 4;
const MSG_OVERHEAD_TOKENS = 4;
const SAFETY_MARGIN_TOKENS = 2000;
const MAX_SINGLE_MSG_FRACTION = 0.8;

// ── Token estimation ──────────────────────────────────────────────────
export function estimateTokens(str) {
  return Math.ceil(String(str || "").length / TOKEN_CHARS);
}

export function estimateImageTokens(width, height, providerFormat) {
  // Anthropic: ~w*h/750. OpenAI (detail=auto): 85 + 170*tiles.
  if (providerFormat === "anthropic") {
    return Math.round((width * height) / 750);
  }
  const tiles = Math.max(1, Math.ceil(width / 512)) * Math.max(1, Math.ceil(height / 512));
  return 85 + 170 * tiles;
}

export function estimateMessageTokens(mm) {
  let t = MSG_OVERHEAD_TOKENS + estimateTokens(mm.content);
  if (mm.tokenEstimate) t += mm.tokenEstimate;
  return t;
}

// ── Context window helpers ────────────────────────────────────────────
export function getContextWindowSize(m) {
  const ctx = m && m.context;
  return (typeof ctx === "number" && ctx > 0) ? ctx : null;
}

export function getMaxOutputTokens(m) {
  const ctx = getContextWindowSize(m);
  if (!ctx) return null;
  return Math.min(4096, Math.max(1024, Math.round(ctx * 0.2)));
}

// Keep head (context) + tail (the actual ask) when a single message exceeds the budget.
export function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  const marker = "\n…[truncated to fit the context window]…\n";
  const headLen = Math.floor(maxChars * 0.6);
  const tailLen = maxChars - headLen - marker.length;
  return text.slice(0, headLen) + marker + text.slice(text.length - tailLen);
}

// Walk newest→oldest so freshest turns survive; newest history + current turn never dropped.
// Returns { messages: [{role, content}], singleCapChars: number }.
export function selectContext(m, currentText, currentMediaTokens, messages, systemPrompt) {
  const ctx = getContextWindowSize(m);
  const history = messages.slice(0, -1);

  if (!ctx) {
    return { messages: history.map(mm => ({ role: mm.role, content: mm.content || "" })), singleCapChars: Infinity };
  }

  const maxOutput = getMaxOutputTokens(m) || 4096;
  const budget = ctx - maxOutput - SAFETY_MARGIN_TOKENS;
  const singleCapChars = Math.max(1024, Math.floor(budget * MAX_SINGLE_MSG_FRACTION * TOKEN_CHARS));

  let used = estimateTokens(systemPrompt || "")
           + estimateTokens(currentText || "")
           + (currentMediaTokens || 0)
           + MSG_OVERHEAD_TOKENS * 2;

  const selected = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const mm = history[i];
    let content = String(mm.content || "");
    if (content.length > singleCapChars) content = truncateText(content, singleCapChars);
    const est = MSG_OVERHEAD_TOKENS + estimateTokens(content) + (mm.tokenEstimate || 0);
    if (selected.length > 0 && used + est > budget) break;
    selected.unshift({ role: mm.role, content });
    used += est;
  }

  return { messages: selected, singleCapChars };
}
