/**
 * Model picker: selects the best model for a given endpoint type.
 */

/**
 * Pick a model for a special endpoint kind; chat pick works for any provider.
 * @param {object} providers - merged providers map
 * @param {string} providerId - provider to search within
 * @param {string} kind - "chat" | "transcription" | "tts" | "ocr" | "embeddings" | "moderation"
 * @param {object} KNOWN_EXTRAS - known extra model ids per provider
 * @returns {string|null} model id or null
 */
export function pickModelFor(providers, providerId, kind, KNOWN_EXTRAS) {
  const p = providers[providerId];
  if (!p) return null;

  const entries = Object.entries(p.models || []);

  if (kind === "chat") {
    // Skip image/audio/embed/moderation/ocr model ids so we never land on
    // gpt-image-2 or whisper as default
    const skip = /dall-e|image|whisper|tts|speech|voice|audio-speech|embed|moderat|guard|ocr|sdxl|flux|stable-diffusion/i;
    let best = null;
    for (const [mid, mm] of entries) {
      if (skip.test(mid)) continue;
      const out = mm.output_modalities || [];
      if (!out.includes("text")) continue;
      if (!best || (mm.tool_call && !best[1].tool_call)) best = [mid, mm];
    }
    if (best) return best[0];
    const any = entries.find(([mid]) => !skip.test(mid));
    return any ? any[0] : (entries[0] ? entries[0][0] : null);
  }

  if (p.format !== "openai") return null;

  const extras = KNOWN_EXTRAS[providerId];
  if (extras && extras[kind] !== undefined) return extras[kind];
  if (!entries.length) return null;

  const rx = {
    transcription: /whisper|transcri|asr|speech-to-text/i,
    tts:           /tts|speech|voice|audio-speech|orpheus/i,
    ocr:           /ocr/i,
    embeddings:    /embed/i,
    moderation:    /moderat|guard/i
  }[kind];

  const hit = rx ? entries.find(([mid]) => rx.test(mid)) : null;
  if (hit) return hit[0];

  if (kind === "transcription") {
    const m = entries.find(([mid, mm]) => (mm.input_modalities || []).includes("audio"));
    return m ? m[0] : null;
  }

  if (kind === "tts") {
    const m = entries.find(([mid, mm]) => (mm.output_modalities || []).includes("audio"));
    return m ? m[0] : null;
  }

  return null;
}
