// Makes the favicons and the social share image (og.png) in the ink/stone/coral brand.
// Run with: npm run icons
// Letters are turned into SVG paths (DM Serif Display), so no fonts are needed at render time.
//   public/img/favicon.ico, favicon.svg, favicon-32.png, favicon-512.png, apple-touch-icon.png
//   public/img/og.png (1200x630)
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const C = { ink: '#191B19', stone: '#EAE5DA', coral: '#F2836B', white: '#FFFFFF', muted: '#535A53' };

const fontPath = path.join(root, 'scripts/fonts/DMSerifDisplay-Regular.ttf');
if (!fs.existsSync(fontPath)) {
  fs.mkdirSync(path.dirname(fontPath), { recursive: true });
  const res = await fetch('https://github.com/google/fonts/raw/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf');
  if (!res.ok) throw new Error('Could not download DM Serif Display');
  fs.writeFileSync(fontPath, Buffer.from(await res.arrayBuffer()));
}
const serif = opentype.loadSync(fontPath);

// Text as a path, with letter-spacing in em (negative = tighter).
function textPath(str, x, y, size, tracking = -0.02) {
  let d = '';
  let cx = x;
  for (const g of serif.stringToGlyphs(str)) {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += (g.advanceWidth / serif.unitsPerEm) * size + tracking * size;
  }
  return { d, width: cx - x - tracking * size };
}
const centered = (str, cx, y, size, tracking) => {
  const w = textPath(str, 0, 0, size, tracking).width;
  return textPath(str, cx - w / 2, y, size, tracking).d;
};

// FF monogram: one ink "F" and one white "F" (serif) on a coral circle, same as the nav badge.
// Apple adds its own rounded corners, so the touch icon is a full coral square instead.
function iconSvg(size, { square = false } = {}) {
  const s = 512;
  const fs_ = s * (square ? 0.5 : 0.62);
  const tracking = -0.05;
  const one = textPath('F', 0, 0, fs_, tracking).width;
  const adv = (serif.charToGlyph('F').advanceWidth / serif.unitsPerEm) * fs_ + tracking * fs_;
  const total = adv + one;
  const x = s / 2 - total / 2;
  const y = s * (square ? 0.665 : 0.69);
  const bg = square
    ? `<rect width="${s}" height="${s}" fill="${C.coral}"/>`
    : `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="${C.coral}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  ${bg}<path d="${textPath('F', x, y, fs_, tracking).d}" fill="${C.ink}"/><path d="${textPath('F', x + adv, y, fs_, tracking).d}" fill="${C.white}"/></svg>`;
}
const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

const img = path.join(root, 'public/img');
const p32 = await png(iconSvg(32), 32);
fs.writeFileSync(path.join(img, 'favicon-32.png'), p32);
fs.writeFileSync(path.join(img, 'favicon-512.png'), await png(iconSvg(512), 512));
// Apple adds its own rounded corners, so the touch icon is a full square.
fs.writeFileSync(path.join(img, 'apple-touch-icon.png'), await png(iconSvg(180, { square: true }), 180));
fs.writeFileSync(path.join(img, 'favicon.svg'), iconSvg(512).replace(/ width="512" height="512"/, ''));

// favicon.ico holding 16, 32 and 48px PNGs.
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((n) => png(iconSvg(n), n)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((n, i) => {
  const o = 6 + 16 * i;
  header.writeUInt8(n, o); header.writeUInt8(n, o + 1); header.writeUInt8(0, o + 2); header.writeUInt8(0, o + 3);
  header.writeUInt16LE(1, o + 4); header.writeUInt16LE(32, o + 6);
  header.writeUInt32LE(pngs[i].length, o + 8); header.writeUInt32LE(offset, o + 12);
  offset += pngs[i].length;
});
fs.writeFileSync(path.join(img, 'favicon.ico'), Buffer.concat([header, ...pngs]));

// Social share image: stone page, serif wordmark, the headline and a small coral bar.
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${C.stone}"/>
  <path d="${textPath('Fake Fanatic', 80, 118, 44).d}" fill="${C.ink}"/>
  <path d="${textPath('“Did you catch the game?”', 80, 320, 90).d}" fill="${C.ink}"/>
  <rect x="84" y="366" width="110" height="6" fill="${C.coral}" transform="rotate(-3 139 369)"/>
  <path d="${textPath('Of course you didn’t. Now fake it like you did.', 80, 480, 44, -0.01).d}" fill="${C.muted}"/>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(path.join(img, 'og.png'));
console.log('Wrote favicons and og.png');
