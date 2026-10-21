// Génère les icônes PNG de la PWA (sans dépendance) : fond indigo NEOTRADE, « N » blanc barré du trait vert du logo.
// Usage : npm run icons
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const INDIGO = [0x24, 0x23, 0x4b];
const WHITE = [0xff, 0xff, 0xff];
const GREEN = [0x68, 0xdc, 0x8f];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** Le trait vert, prolongement de la diagonale du N au-delà des montants (comme le logo). */
function inSlash(x, y, scale) {
  const u = (x - 0.5) / scale + 0.5;
  const v = (y - 0.5) / scale + 0.5;
  const ax = 0.2, ay = 0.1, bx = 0.8, by = 0.9;
  const t = Math.max(0, Math.min(1, ((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(u - (ax + t * (bx - ax)), v - (ay + t * (by - ay))) <= 0.028;
}

/** Le « N » dans un carré unité [0,1]² ; scale < 1 réduit le dessin (zone sûre des icônes maskable). */
function inN(x, y, scale) {
  const u = (x - 0.5) / scale + 0.5;
  const v = (y - 0.5) / scale + 0.5;
  if (v < 0.22 || v > 0.78) return false;
  const w = 0.13;
  if (u >= 0.24 && u <= 0.24 + w) return true;
  if (u >= 0.76 - w && u <= 0.76) return true;
  // diagonale de (0.24, 0.22) à (0.76, 0.78)
  const t = (v - 0.22) / 0.56;
  const cx = 0.24 + w / 2 + t * (0.52 - w);
  return u >= 0.24 && u <= 0.76 && Math.abs(u - cx) <= w * 0.62;
}

function png(size, scale) {
  const ss = 4; // sur-échantillonnage pour lisser les bords
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let white = 0;
      let green = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const px = (x + (sx + 0.5) / ss) / size;
          const py = (y + (sy + 0.5) / ss) / size;
          if (inSlash(px, py, scale)) green++;
          else if (inN(px, py, scale)) white++;
        }
      const n = ss * ss;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round((INDIGO[c] * (n - white - green) + WHITE[c] * white + GREEN[c] * green) / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 2; // RVB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = new URL("../public/icons/", import.meta.url);
mkdirSync(dir, { recursive: true });
const out = { "icon-192.png": [192, 1], "icon-512.png": [512, 1], "icon-maskable-512.png": [512, 0.72], "apple-touch-icon.png": [180, 0.85] };
for (const [name, [size, scale]] of Object.entries(out)) writeFileSync(new URL(name, dir), png(size, scale));
console.log("Icônes générées dans public/icons/ (favicon.ico : à régénérer depuis icon-192.png si le logo change)");
