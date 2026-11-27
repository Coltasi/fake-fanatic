// Email images in the ink/stone/coral brand. Run with: npm run brand
// Writes public/email/* (served from /email/ and loaded by the Nitrosend emails):
//   logo.png          "Fake Fanatic" wordmark in DM Serif Display, ink on transparent
//   welcome.jpg, weekly.jpg, super-bowl.jpg   1200x680 banners (shown at 600px)
// Headlines are baked into the images because email apps can't load DM Serif Display.
// Letters are turned into SVG paths, so no fonts are needed at render time.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const C = { ink: '#191B19', ivory: '#FBF8EF', coral: '#F2836B', soft: '#D9D6CC' };

const fontPath = path.join(root, 'scripts/fonts/DMSerifDisplay-Regular.ttf');
if (!fs.existsSync(fontPath)) {
  fs.mkdirSync(path.dirname(fontPath), { recursive: true });
  const res = await fetch('https://github.com/google/fonts/raw/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf');
  if (!res.ok) throw new Error('Could not download DM Serif Display');
  fs.writeFileSync(fontPath, Buffer.from(await res.arrayBuffer()));
}
const serif = opentype.loadSync(fontPath);

// Text as an SVG path with letter-spacing in em (negative = tighter).
function textPath(str, x, y, size, tracking = -0.02) {
  let d = '', cx = x;
  for (const g of serif.stringToGlyphs(str)) {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += (g.advanceWidth / serif.unitsPerEm) * size + tracking * size;
  }
  return { d, width: cx - x - tracking * size };
}

const emailDir = path.join(root, 'public/email');
fs.mkdirSync(emailDir, { recursive: true });

// Banner: grayscale photo, soft ink fade at the bottom, ivory serif headline,
// a short line above it and a small rotated coral bar under it.
async function banner(file, photo, lines, { kicker, focus = 'centre', size = 96, crop } = {}) {
  const W = 1200, H = 680, X = 64;
  let src = sharp(path.join(root, 'assets/photos', photo));
  if (crop) src = sharp(await src.extract(crop).toBuffer());
  const img = await src.resize(W, H, { fit: 'cover', position: focus }).grayscale().toBuffer();
  const lh = size * 1.04;
  const bottom = H - 104;
  const head = lines.map((s, i) => textPath(s, X, bottom - (lines.length - 1 - i) * lh, size).d).join('');
  const kickY = bottom - (lines.length - 1) * lh - size - 18;
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.2" stop-color="${C.ink}" stop-opacity="0"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0.9"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${kicker ? `<path d="${textPath(kicker, X, kickY, 34, 0).d}" fill="${C.soft}"/>` : ''}
    <path d="${head}" fill="${C.ivory}"/>
    <rect x="${X + 2}" y="${bottom + 36}" width="120" height="6" fill="${C.coral}" transform="rotate(-3 ${X + 62} ${bottom + 39})"/>
  </svg>`;
  await sharp(img).composite([{ input: Buffer.from(overlay) }]).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(emailDir, file));
}

// Wordmark logo, 2x for a 220px-wide display.
{
  const size = 88, { d, width } = textPath('Fake Fanatic', 4, 84, size);
  const W = Math.ceil(width + 8), H = 112;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="${C.ink}"/></svg>`;
  await sharp(Buffer.from(svg)).resize({ width: 440 }).png({ compressionLevel: 9 }).toFile(path.join(emailDir, 'logo.png'));
}

await banner('welcome.jpg', 'confused-fan.png', ['You\u2019re on the list.'], { kicker: 'This is you. For now.', focus: 'top', size: 104 });
await banner('weekly.jpg', 'lp-stadium-night.jpg', ['This week\u2019s cheat sheet'], { kicker: 'Free every Tuesday', size: 92 });
await banner('super-bowl.jpg', 'confused-fan.png', ['Super Bowl party', 'survival guide'], { kicker: 'Sunday, Feb 14', crop: { left: 600, top: 0, width: 776, height: 440 }, size: 88 });
console.log('Email images written.');
