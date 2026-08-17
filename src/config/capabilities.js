/**
 * Capability metadata: maps capability keys to UI labels, icon names, and short codes.
 * Drives the capability chip strip in the header and the model picker.
 */

export const CAP_META = {
  vision:                 { label:"Image",           icon:"Image",           svgIcon:"eye_vision",                 short:"vision" },
  function_calling:       { label:"Tools",           icon:"Tools",           svgIcon:"wrench_tools",               short:"tools" },
  reasoning:              { label:"Reasoning",       icon:"Reasoning",       svgIcon:"brain_reasoning",             short:"reasoning" },
  audio:                  { label:"Audio",           icon:"Audio",           svgIcon:"microphone",                  short:"audio" },
  audio_transcription:    { label:"STT",             icon:"STT",             svgIcon:"mic_soundwaves_stt",           short:"transcription" },
  tts:                    { label:"TTS",             icon:"TTS",             svgIcon:"speaker_sound_tts",            short:"tts" },
  ocr:                    { label:"OCR",             icon:"OCR",             svgIcon:"scan_ocr",                    short:"ocr" },
  embeddings:             { label:"Embeddings",      icon:"Embeddings",      svgIcon:"database_embeddings",          short:"embeddings" },
  moderation:             { label:"Moderation",      icon:"Moderation",      svgIcon:"shield_moderation",            short:"moderation" },
  web_search:             { label:"Search",          icon:"Search",          svgIcon:"globe_websearch",              short:"search" },
  parallel_tool_calling:  { label:"PTC",             icon:"PTC",             svgIcon:"layers_parallel_tools",        short:"ptc" },
  image_generation:       { label:"Image Gen",       icon:"Image Gen",       svgIcon:"palette_imagegen",             short:"image_gen" },
  code_interpreter:       { label:"Code",            icon:"Code",            svgIcon:"terminal_code",                short:"code" },
  thinking:               { label:"Thinking",        icon:"Thinking",        svgIcon:"lightbulb_thinking",           short:"thinking" },
  image_editing:          { label:"Image Edit",      icon:"Image Edit",       short:"image_edit" },
  image_understanding:    { label:"Image Under",     icon:"Image Under",     short:"image_under" },
  image_variation:        { label:"Image Var",       icon:"Image Var",       short:"image_var" },
  image_upscaling:        { label:"Image Up",        icon:"Image Up",        short:"image_up" },
  image_inpainting:       { label:"Image In",        icon:"Image In",        short:"image_in" },
  image_outpainting:      { label:"Image Out",       icon:"Image Out",       short:"image_out" },
  image_masking:          { label:"Image Mask",      icon:"Image Mask",      short:"image_mask" },
  image_segmentation:     { label:"Image Seg",       icon:"Image Seg",       short:"image_seg" },
  image_depth:            { label:"Image Depth",     icon:"Image Depth",     short:"image_depth" },
  image_normal:           { label:"Image Norm",      icon:"Image Norm",      short:"image_norm" },
  image_denoising:        { label:"Image Den",       icon:"Image Den",       short:"image_den" },
  image_super_resolution: { label:"Image SR",        icon:"Image SR",        short:"image_sr" },
  image_style_transfer:   { label:"Image Style",     icon:"Image Style",     short:"image_style" },
  image_animation:        { label:"Image Anim",      icon:"Image Anim",      short:"image_anim" },
  image_3d:               { label:"Image 3D",        icon:"Image 3D",        short:"image_3d" },
  image_3d_view:          { label:"Image 3D View",   icon:"Image 3D View",   short:"image_3d_view" },
  image_3d_model:         { label:"Image 3D Mod",    icon:"Image 3D Mod",    short:"image_3d_model" },
  image_3d_texture:       { label:"Image 3D Tex",    icon:"Image 3D Tex",    short:"image_3d_texture" },
  image_3d_render:        { label:"Image 3D Ren",    icon:"Image 3D Ren",    short:"image_3d_render" },
  image_3d_animation:     { label:"Image 3D Anim",   icon:"Image 3D Anim",   short:"image_3d_animation" },
  image_3d_asset:         { label:"Image 3D Asset",  icon:"Image 3D Asset",  short:"image_3d_asset" },
  image_3d_character:     { label:"Image 3D Char",   icon:"Image 3D Char",   short:"image_3d_character" },
  image_3d_environment:   { label:"Image 3D Env",    icon:"Image 3D Env",    short:"image_3d_environment" },
  image_3d_object:        { label:"Image 3D Obj",    icon:"Image 3D Obj",    short:"image_3d_object" },
  image_3d_scene:         { label:"Image 3D Scene",  icon:"Image 3D Scene",  short:"image_3d_scene" },
  image_3d_style:         { label:"Image 3D Style",  icon:"Image 3D Style",  short:"image_3d_style" },
  image_3d_tool:          { label:"Image 3D Tool",   icon:"Image 3D Tool",   short:"image_3d_tool" },
  image_3d_utility:       { label:"Image 3D Util",   icon:"Image 3D Util",   short:"image_3d_utility" },
  image_3d_variation:     { label:"Image 3D Var",   icon:"Image 3D Var",     short:"image_3d_variation" },
  image_3d_viewer:        { label:"Image 3D Viewer", icon:"Image 3D Viewer",  short:"image_3d_viewer" },
  image_3d_visualization: { label:"Image 3D Vis",    icon:"Image 3D Vis",    short:"image_3d_visualization" },
  image_3d_voxel:         { label:"Image 3D Vox",    icon:"Image 3D Vox",    short:"image_3d_voxel" },
  image_3d_wireframe:     { label:"Image 3D Wire",   icon:"Image 3D Wire",   short:"image_3d_wireframe" },
  image_3d_xray:          { label:"Image 3D Xray",   icon:"Image 3D Xray",   short:"image_3d_xray" },
  image_3d_zoom:          { label:"Image 3D Zoom",   icon:"Image 3D Zoom",   short:"image_3d_zoom" },
  image_3d_zoom_in:       { label:"Image 3D Zoom In",icon:"Image 3D Zoom In", short:"image_3d_zoom_in" },
  image_3d_zoom_out:      { label:"Image 3D Zoom Out",icon:"Image 3D Zoom Out", short:"image_3d_zoom_out" },
  image_3d_zoom_to:       { label:"Image 3D Zoom To",icon:"Image 3D Zoom To", short:"image_3d_zoom_to" },
  image_3d_zoom_to_fit:   { label:"Image 3D Zoom Fit",icon:"Image 3D Zoom Fit", short:"image_3d_zoom_to_fit" },
};

/** Returns an SVG icon string for a capability key, falling back to the label. */
export function capIcon(k, iconFn) {
  const meta = CAP_META[k];
  if (meta && meta.svgIcon && typeof iconFn === "function") return iconFn(meta.svgIcon);
  return meta ? meta.icon : "•";
}

/**
 * Determines the endpoint type for a model from its capabilities.
 * Drives which API function gets called and which UI to show.
 */
export function getEndpointType(caps) {
  if (!caps) return "chat";
  if (caps.audio_transcription) return "transcription";
  if (caps.tts) return "tts";
  if (caps.ocr) return "ocr";
  if (caps.embeddings) return "embeddings";
  if (caps.moderation) return "moderation";
  return "chat";
}
