// Generates og-image.png (1200×630) and PWA icons (192/512) with the Relay
// diamond glyph — zero dependencies, raw PNG encoding via node:zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
mkdirSync(pub, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Palette — paper workbench
const PAPER = [250, 246, 239];
const INK = [25, 23, 20];
const ACCENT = [228, 87, 46];

/** Draw the Relay glyph: filled diamond with an inner paper diamond. */
function renderRelay(width, height, { bg = PAPER, fg = ACCENT, ring = INK } = {}) {
  const rgba = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const rOuter = Math.min(width, height) * 0.34;
  const rInner = rOuter * 0.62;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const d = Math.abs(x - cx + 0.5) + Math.abs(y - cy + 0.5);
      let c = bg;
      if (d <= rOuter && d > rInner) c = fg;
      else if (d <= rInner) c = bg;
      // subtle ring
      const rr = Math.hypot(x - cx + 0.5, y - cy + 0.5);
      if (rr > rOuter * 1.28 && rr < rOuter * 1.34) c = ring;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

// OG image: ink background, orange diamond — reads well in social cards.
writeFileSync(join(pub, 'og-image.png'), encodePNG(1200, 630, renderRelay(1200, 630, { bg: INK, fg: ACCENT, ring: [46, 42, 36] })));
writeFileSync(join(pub, 'icon-192.png'), encodePNG(192, 192, renderRelay(192, 192)));
writeFileSync(join(pub, 'icon-512.png'), encodePNG(512, 512, renderRelay(512, 512)));
writeFileSync(join(pub, 'apple-touch-icon.png'), encodePNG(180, 180, renderRelay(180, 180)));

console.log('assets written to public/');
