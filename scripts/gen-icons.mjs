// Generates placeholder extension icons (teal rounded square with a white
// cent-like glyph) as raw PNGs — no image dependencies needed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw.set([r, g, b, a], row + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG_TOP = [20, 184, 166]; // teal-500
const BG_BOTTOM = [15, 118, 110]; // teal-700

function insideRoundedSquare(u, v) {
  const r = 0.18;
  const cx = Math.max(r - u, u - (1 - r), 0);
  const cy = Math.max(r - v, v - (1 - r), 0);
  return cx * cx + cy * cy <= r * r;
}

// Cent-like glyph: C-shaped ring with an opening on the right, plus a
// vertical bar through the middle.
function insideGlyph(u, v) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx); // 0 points right
  const inRing =
    dist < 0.3 && dist > 0.185 && Math.abs(angle) > (40 * Math.PI) / 180;
  const inBar = Math.abs(dx) < 0.05 && v > 0.14 && v < 0.86;
  return inRing || inBar;
}

// 4x4 supersampling for smooth edges at small sizes.
function pixel(x, y, size) {
  const SS = 4;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      const u = (x + (sx + 0.5) / SS) / size;
      const v = (y + (sy + 0.5) / SS) / size;
      if (!insideRoundedSquare(u, v)) continue;
      let sr;
      let sg;
      let sb;
      if (insideGlyph(u, v)) {
        sr = 255;
        sg = 255;
        sb = 255;
      } else {
        sr = BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * v;
        sg = BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * v;
        sb = BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * v;
      }
      r += sr;
      g += sg;
      b += sb;
      a += 255;
    }
  }
  const n = SS * SS;
  if (a === 0) return [0, 0, 0, 0];
  // Un-premultiply: average color over covered samples, alpha over all.
  const covered = a / 255;
  return [
    Math.round(r / covered),
    Math.round(g / covered),
    Math.round(b / covered),
    Math.round(a / n),
  ];
}

const outDir = join(root, 'public', 'icon');
mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 96, 128]) {
  writeFileSync(join(outDir, `${size}.png`), png(size, pixel));
}
console.log('icons written to public/icon/');
