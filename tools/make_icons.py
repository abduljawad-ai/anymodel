#!/usr/bin/env python3
"""
make_icons.py - Hand-drawn SVG icon pipeline for AnyModel.

Draws all 45 app icons as raw SVG path strings directly in Python
(coordinates, no raster input, no tracing tools). Produces:

  assets/icons/svg/*.svg          one optimized SVG per icon
  assets/icons/contact-sheet.png  ImageMagick montage preview
  docs/ICON-INVENTORY.md          inventory table

Icon spec: viewBox 0 0 24 24, fill none, stroke currentColor,
stroke-width 2, round caps and joins. The stroke style lives once on
the <svg> root so each file stays tiny and themeable via CSS color.

Usage:  python3 tools/make_icons.py
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SVG_DIR = ROOT / "assets" / "icons" / "svg"
CONTACT_SHEET = ROOT / "assets" / "icons" / "contact-sheet.png"
DOCS = ROOT / "docs" / "ICON-INVENTORY.md"
PREVIEW_DIR = ROOT / ".icon-preview"  # temp dir, deleted after montage

# ---------------------------------------------------------------------------
# Icon geometry. Every entry is a list of path strings (`d`), plus optional
# circles/rects/ellipses for shapes that are simpler to describe that way.
# All coordinates target the 0..24 viewBox with 2px strokes, so the drawable
# core sits between roughly x/y 2 and 22.
# ---------------------------------------------------------------------------

PathList = list[str]

ICONS: dict[str, dict] = {
    # -- batch 1: navigation & appearance ------------------------------------
    "menu_hamburger": {
        "paths": ["M3 6h18", "M3 12h18", "M3 18h18"],
        "use": "Open the collapsible sidebar / navigation menu",
    },
    "close_x": {
        "paths": ["M18 6 6 18", "m6 6 12 12"],
        "use": "Close panels, dismiss prompts, clear input",
    },
    "plus_newchat": {
        "paths": ["M12 5v14", "M5 12h14"],
        "use": "Start a new conversation",
    },
    "settings_gear": {
        "paths": [
            "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"],
        "circles": [(12, 12, 3)],
        "use": "Open settings / configure the app",
    },
    "sun_lightmode": {
        "paths": [
            "M12 2v2", "M12 20v2",
            "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41",
            "M2 12h2", "M20 12h2",
            "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41",
        ],
        "circles": [(12, 12, 4)],
        "use": "Switch to light mode",
    },
    "moon_darkmode": {
        "paths": ["M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"],
        "use": "Switch to dark mode",
    },
    "user_silhouette": {
        "paths": ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"],
        "circles": [(12, 7, 4)],
        "use": "User account / profile avatar",
    },
    "bot_robot_face": {
        "paths": ["M12 3v4", "M2 12h2", "M20 12h2", "M9 15.5h6"],
        "rects": [(4, 7, 16, 11.5, 2.5)],
        "circles": [(8.5, 9.5, 0.9, True), (15.5, 9.5, 0.9, True)],
        "use": "AI assistant / assistant model badge",
    },
    "info_circle": {
        "paths": ["M12 16v-4", "M12 8h.01"],
        "circles": [(12, 12, 10)],
        "use": "About / model info / help",
    },

    # -- batch 2: composer actions -------------------------------------------
    "send_airplane": {
        "paths": ["M22 2 11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
        "use": "Send the message",
    },
    "stop_square": {
        "rects": [(3.5, 3.5, 17, 17, 2)],
        "use": "Stop generation / abort streaming",
    },
    "copy_duplicate": {
        "paths": ["M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
        "rects": [(9, 9, 13, 13, 2)],
        "use": "Copy response / code / prompt",
    },
    "check_confirm": {
        "paths": ["M20 6 9 17l-5-5"],
        "use": "Confirm action / success state",
    },
    "trash_delete": {
        "paths": [
            "M3 6h18",
            "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
            "M10 11v6", "M14 11v6",
        ],
        "use": "Delete conversation / clear context",
    },
    "pencil_edit": {
        "paths": ["M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"],
        "use": "Edit a message or prompt",
    },
    "regenerate_arrow": {
        "paths": ["M23 4v6h-6", "M20.49 15a9 9 0 1 1-2.12-9.36L23 10"],
        "use": "Regenerate the last response",
    },
    "thumbs_up": {
        "paths": [
            "M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z",
            "M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3",
        ],
        "use": "Rate response helpful",
    },
    "thumbs_down": {
        "paths": [
            "M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z",
            "M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17",
        ],
        "use": "Rate this response unhelpful",
    },

    # -- batch 3: media & files ----------------------------------------------
    "microphone": {
        "paths": ["M5 10a7 7 0 0 0 14 0", "M12 19v4"],
        "rects": [(9, 2, 6, 13, 3)],
        "use": "Voice / speech input",
    },
    "play_triangle": {
        "paths": ["M5 3l14 9-14 9Z"],
        "use": "Play audio / video output",
    },
    "pause_bars": {
        "rects": [(6, 4, 4, 16, 1), (14, 4, 4, 16, 1)],
        "use": "Pause playback / streaming",
    },
    "volume_speaker": {
        "paths": ["M11 5 6 9H2v6h4l5 4Z", "M15.54 8.46a5 5 0 0 1 0 7.07"],
        "use": "Speaker volume / audio output",
    },
    "sound_waveform": {
        "paths": ["M22 12h-4l-3 9L9 3l-3 9H2"],
        "use": "Sound activity / audio waveform",
    },
    "image_photo": {
        "paths": ["M21 15l-5-5L5 21"],
        "rects": [(3, 3, 18, 18, 2)],
        "circles": [(8.5, 8.5, 1.5)],
        "use": "Image display / image generation result",
    },
    "camera": {
        "paths": [
            "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z",
        ],
        "circles": [(12, 13, 4)],
        "use": "Capture a photo / camera input",
    },
    "file_document": {
        "paths": [
            "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z",
            "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8",
        ],
        "use": "File / document attachment",
    },
    "download_arrow": {
        "paths": ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
        "use": "Download / export output",
    },

    # -- batch 4: vision, code & tooling -------------------------------------
    "eye_vision": {
        "paths": ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"],
        "circles": [(12, 12, 3)],
        "use": "Vision input / image understanding",
    },
    "brain_reasoning": {
        "paths": [
            "M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z",
            "M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z",
        ],
        "use": "Reasoning / deep-think model indicator",
    },
    "sparkle_wand": {
        "paths": [
            "m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z",
            "m14 7 3 3", "M5 6v4", "M19 14v4", "M10 2v2", "M7 8H3", "M21 16h-4", "M11 3H9",
        ],
        "use": "Magic wand / polish, refine, generate",
    },
    "wrench_tools": {
        "paths": [
            "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
        ],
        "use": "Tools / maintenance, advanced options",
    },
    "shield_moderation": {
        "paths": ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "m9 11.5 2 2 4-4"],
        "use": "Content moderation / safety guardrails",
    },
    "search_magnifier": {
        "paths": ["m21 21-4.35-4.35"],
        "circles": [(11, 11, 8)],
        "use": "Search models, chats, or messages",
    },
    "terminal_code": {
        "paths": ["m4 17 6-6-6-6", "M12 19h8"],
        "use": "Code / developer mode",
    },
    "globe_websearch": {
        "paths": ["M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
        "circles": [(12, 12, 10)],
        "use": "Web search tool",
    },
    "database_embeddings": {
        "paths": ["M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"],
        "ellipses": [(12, 5, 9, 3), (12, 12, 9, 3), (12, 19, 9, 3)],
        "use": "Embeddings / vector retrieval",
    },

    # -- batch 5: recognition & generation -----------------------------------
    "scan_ocr": {
        "paths": [
            "M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2",
            "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2",
            "M7 11h10", "M7 14h10", "M7 17h6",
        ],
        "use": "Scan / OCR a document or image",
    },
    "palette_imagegen": {
        "paths": [
            "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z",
        ],
        "circles": [(13.5, 6.5, 1, True), (17.5, 10.5, 1, True), (8.5, 7.5, 1, True), (6.5, 12.5, 1, True)],
        "use": "Image generation / aesthetic controls",
    },
    "layers_parallel_tools": {
        "paths": [
            "M12 2 2 7l10 5 10-5Z",
            "m2 12 10 5 10-5",
            "m2 17 10 5 10-5",
        ],
        "use": "Layers / parallel tool calls",
    },
    "mic_soundwaves_stt": {
        "paths": [
            "M5 10a7 7 0 0 0 14 0", "M12 19v4",
            "M16.5 7.5a4.5 4.5 0 0 1 0 9",
            "M19.5 4.5a7.5 7.5 0 0 1 0 15",
        ],
        "rects": [(9, 2, 6, 13, 3)],
        "use": "Speech-to-text transcription",
    },
    "speaker_sound_tts": {
        "paths": [
            "M11 5 6 9H2v6h4l5 4Z",
            "M19.07 4.93a10 10 0 0 1 0 14.14",
            "M15.54 8.46a5 5 0 0 1 0 7.07",
        ],
        "use": "Text-to-speech audio output",
    },
    "lightbulb_thinking": {
        "paths": [
            "M9 18h6", "M10 22h4",
            "M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z",
        ],
        "use": "Thinking / suggestions / insight",
    },
    "lock_security": {
        "paths": ["M7 11V7a5 5 0 0 1 10 0v4"],
        "rects": [(3, 11, 18, 10, 2)],
        "use": "Privacy / security / locked content",
    },
    "chevron_down": {
        "paths": ["m6 9 6 6 6-6"],
        "use": "Dropdown / expand / collapse",
    },
    "chevron_right": {
        "paths": ["m9 18 6-6-6-6"],
        "use": "Navigate forward / close sidebar",
    },
}

BATCHES: dict[str, list[str]] = {
    "1 navigation & appearance": ["menu_hamburger", "close_x", "plus_newchat", "settings_gear",
                                  "sun_lightmode", "moon_darkmode", "user_silhouette",
                                  "bot_robot_face", "info_circle"],
    "2 sending actions": ["send_airplane", "stop_square", "copy_duplicate", "check_confirm",
                          "trash_delete", "pencil_edit", "regenerate_arrow", "thumbs_up",
                          "thumbs_down"],
    "3 media & audio": ["microphone", "play_triangle", "pause_bars", "volume_speaker",
                        "sound_waveform", "image_photo", "camera", "file_document",
                        "download_arrow"],
    "4 vision & tooling": ["eye_vision", "brain_reasoning", "sparkle_wand", "wrench_tools",
                           "shield_moderation", "search_magnifier", "terminal_code",
                           "globe_websearch", "database_embeddings"],
    "5 recognition & generation": ["scan_ocr", "palette_imagegen", "layers_parallel_tools",
                                   "mic_soundwaves_stt", "speaker_sound_tts",
                                   "lightbulb_thinking", "lock_security", "chevron_down",
                                   "chevron_right"],
}


def fmt(n: float) -> str:
    """Compact number formatting: 12.0 -> '12', 2.83 -> '2.83'."""
    return str(n).rstrip("0").rstrip(".") if isinstance(n, float) else str(n)


def icon_body(name: str) -> str:
    """Render one icon's inner elements as a single line of SVG markup."""
    spec = ICONS[name]
    parts: list[str] = []
    for d in spec.get("paths", []):
        parts.append(f'<path d="{d}"/>')
    for item in spec.get("circles", []):
        cx, cy, r = item[0], item[1], item[2]
        fill = ' fill="currentColor"' if len(item) > 3 and item[3] else ""
        parts.append(f'<circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(r)}"{fill}/>')
    for item in spec.get("rects", []):
        x, y, w, h = item[0], item[1], item[2], item[3]
        rx = f' rx="{fmt(item[4])}"' if len(item) > 4 else ""
        parts.append(f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}"{rx}/>')
    for item in spec.get("ellipses", []):
        cx, cy, rx, ry = item
        parts.append(f'<ellipse cx="{fmt(cx)}" cy="{fmt(cy)}" rx="{fmt(rx)}" ry="{fmt(ry)}"/>')
    return "".join(parts)


def render_svg(name: str) -> str:
    """One optimized SVG per icon. Attributes live on the root, not each path."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        'fill="none" stroke="currentColor" stroke-width="2" '
        'stroke-linecap="round" stroke-linejoin="round">'
        f"{icon_body(name)}"
        "</svg>"
    )


def write_svgs() -> None:
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    for name in ICONS:
        (SVG_DIR / f"{name}.svg").write_text(render_svg(name), encoding="utf-8")
    print(f"Wrote {len(ICONS)} optimized SVGs to {SVG_DIR.relative_to(ROOT)}")


def make_contact_sheet() -> None:
    """Montage a labeled preview sheet. ImageMagick's internal SVG renderer
    doesn't resolve `currentColor`, so previews get an explicit color."""
    if not shutil_available("montage"):
        print("!! ImageMagick 'montage' not found; skipping contact sheet")
        return
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    print("Rendering preview PNGs with ImageMagick...")
    for name in ICONS:
        svg = render_svg(name).replace('stroke="currentColor"', 'stroke="#111827"')
        src = PREVIEW_DIR / f"{name}.svg"
        dst = PREVIEW_DIR / f"{name}.png"
        src.write_text(svg, encoding="utf-8")
        subprocess.run(
            ["convert", "-background", "none", "-density", "192",
             str(src), "-resize", "64x64", str(dst)],
            check=True, capture_output=True,
        )
    print("Packing contact sheet...")
    files = [str(PREVIEW_DIR / f"{name}.png") for name in ICONS]
    subprocess.run(
        ["montage", "-background", "#ffffff", "-fill", "#374151", "-font", "DejaVu-Sans",
         "-label", "%t", "-tile", "5x9", "-geometry", "64x64+12+30",
         *files, str(CONTACT_SHEET)],
        check=True, capture_output=True,
    )
    shutil_cleanup()
    print(f"Contact sheet -> {CONTACT_SHEET.relative_to(ROOT)}")


def shutil_available(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def shutil_cleanup() -> None:
    shutil.rmtree(PREVIEW_DIR, ignore_errors=True)


def write_inventory() -> None:
    doc = f"""# AnyModel Icon Inventory

Hand-drawn SVG icon set for AnyModel. Every icon is a set of SVG path
strings authored directly in Python (`tools/make_icons.py`) and saved as an
optimized SVG to `assets/icons/svg/`. No tracing, no raster input, no
JPEGs: pure code to SVG, one pass.

## Spec

- viewBox `0 0 24 24`
- `stroke="currentColor"` (themes with the surrounding CSS color)
- `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
- `fill="none"` (dots inside palette/bot use `fill="currentColor"`)

## Pipeline

1. `python3 tools/make_icons.py` regenerates all 45 SVGs, the contact
   sheet, and this inventory.
2. SVGs are written to `assets/icons/svg/<name>.svg`; the sheet to
   `assets/icons/contact-sheet.png`.

## Inventory

{len(ICONS)} icons across {len(BATCHES)} batches:

"""

    for batch, names in BATCHES.items():
        doc += f"### Batch {batch}\n\n"
        doc += "| # | file | meaning in app | structure |\n"
        doc += "| --- | --- | --- | --- |\n"
        for i, name in enumerate(names, 1):
            spec = ICONS[name]
            notes = []
            n = len(spec.get("paths", []))
            notes.append(f"{n} path{'s' if n != 1 else ''}")
            for k, label in (("circles", "circle"), ("rects", "rect"), ("ellipses", "ellipse")):
                m = len(spec.get(k, []))
                if m:
                    notes.append(f"{m} {label}{'s' if m != 1 else ''}")
            doc += f"| {i} | `{name}.svg` | {ICONS[name]['use']} | {', '.join(notes)} |\n"
        doc += "\n"

    doc += """## Usage in the UI

```html
<img src="assets/icons/svg/search_magnifier.svg" alt="Search"
     style="color: currentColor">
```

Because the stroke color is `currentColor`, wrap the SVG in any element
with a `color` to tint it for light/dark mode, hover, or focus states.

## Notes

- Icons are keyed by the same discouraged material names the cropped
  PNGs (`assets/cropped_pngs/`) used, so the mapping from the old
  raster batches is one-to-one.
- `pause_bars`, `stop_square`, and `copy_duplicate` share a family
  style with `menu_hamburger`; glyph differences come from the
  coordinate set, not from raster input.
"""
    DOCS.parent.mkdir(parents=True, exist_ok=True)
    DOCS.write_text(doc, encoding="utf-8")
    print(f"Inventory -> {DOCS.relative_to(ROOT)}")


def main() -> None:
    write_svgs()
    make_contact_sheet()
    write_inventory()
    print("Done.")


if __name__ == "__main__":
    main()