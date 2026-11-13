// One-off generator for the FF logo mark and the email images.
// Run with: npm run brand
// It downloads the two open-source fonts (Kaushan Script, Graduate), turns the
// letters into SVG paths, and writes:
//   src/partials/logo-mark.svg      inline logo used in the nav and footer
//   public/email/*                  logo + headline banners used in the Nitrosend emails
// Favicons and og.png are your own files in public/img/ and are not touched.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fontDir = path.join(root, 'scripts/fonts');
const C = { navy: '#1c2357', orange: '#f26a2e', cream: '#f4ecd8', gold: '#e8b54a', white: '#ffffff' };

async function font(file, url) {
  const p = path.join(fontDir, file);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(fontDir, { recursive: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not download ${url}`);
    fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return opentype.loadSync(p);
}

const kaushan = await font('KaushanScript-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/kaushanscript/KaushanScript-Regular.ttf');
const graduate = await font('Graduate-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/graduate/Graduate-Regular.ttf');

const F = (x, y) => kaushan.getPath('F', x, y, 80).toPathData(2);

// The mark, following the brand kit: back F orange, front F navy, each with a
// thick ring in the ground colour so the overlap reads as a gap.
// `ground` is the colour of the outline ring (cream on light, navy on dark).
function mark({ ground = C.cream, back = C.orange, front = C.navy, edge = C.navy, shadow = true } = {}) {
  const a = F(20, 84), b = F(52, 96);
  const sh = shadow
    ? `<g transform="translate(3 3)" fill="${C.navy}"><path d="${a}" stroke="${C.navy}" stroke-width="6" stroke-linejoin="round"/><path d="${b}" stroke="${C.navy}" stroke-width="6" stroke-linejoin="round"/></g>`
    : '';
  return `${sh}<path d="${a}" fill="${ground}" stroke="${ground}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="${a}" fill="${back}" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round" paint-order="stroke"/>` +
    `<path d="${b}" fill="${ground}" stroke="${ground}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="${b}" fill="${front}" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round" paint-order="stroke"/>`;
}

// Inline logo for the site (cream ring + small navy drop shadow).
fs.writeFileSync(path.join(root, 'src/partials/logo-mark.svg'),
  `<svg class="ff-mark" viewBox="0 0 124 112" width="56" height="51" aria-hidden="true" focusable="false">${mark()}</svg>\n`);

// ---------- Email images (served from /email/, used by the Nitrosend templates) ----------
// Banners are 1200px wide (shown at 600px in email). Headlines are baked into the image
// because email apps can't load Graduate.
const emailDir = path.join(root, 'public/email');
fs.mkdirSync(emailDir, { recursive: true });

function headline(lines, { size, x = 60, bottom, colors }) {
  // lines: array of strings, drawn bottom-up so the last line sits at `bottom`
  let out = '';
  const lh = size * 1.02;
  lines.forEach((s, i) => {
    const y = bottom - (lines.length - 1 - i) * lh;
    const [fill, shadow] = colors[i % colors.length];
    const d = graduate.getPath(s, x, y, size).toPathData(2);
    const off = Math.max(3, Math.round(size / 18));
    out += `<path d="${d}" fill="${shadow}" transform="translate(${off} ${off})"/><path d="${d}" fill="${fill}"/>`;
  });
  return out;
}

async function banner(file, photo, lines, { pill, focus = 'centre', size = 92, crop } = {}) {
  const W = 1200, H = 680;
  let src = sharp(path.join(root, 'assets/photos', photo));
  if (crop) src = sharp(await src.extract(crop).toBuffer()); // zoom into part of the photo
  const img = await src.resize(W, H, { fit: 'cover', position: focus }).toBuffer();
  const pillSvg = pill
    ? (() => { const p = graduate.getPath(pill, 0, 0, 26); const bb = p.getBoundingBox(); const w = bb.x2 - bb.x1 + 44;
        return `<rect x="60" y="48" width="${w}" height="52" rx="26" fill="${C.orange}"/><rect x="60" y="48" width="${w}" height="52" rx="26" fill="none" stroke="${C.navy}" stroke-width="3"/>` +
          `<path d="${graduate.getPath(pill, 82 - bb.x1, 83, 26).toPathData(2)}" fill="${C.white}"/>`; })()
    : '';
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.25" stop-color="${C.navy}" stop-opacity="0"/><stop offset="1" stop-color="${C.navy}" stop-opacity="0.92"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect y="${H - 14}" width="${W}" height="14" fill="${C.orange}"/>
    ${pillSvg}
    ${headline(lines, { size, bottom: H - 62, colors: [[C.white, C.orange], [C.orange, C.navy]] })}
  </svg>`;
  await sharp(img).composite([{ input: Buffer.from(overlay) }]).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(emailDir, file));
}

// Logo lockup: FF mark + wordmark, transparent background, 2x for a 220px-wide display.
{
  const word = graduate.getPath('FAKE FANATIC', 0, 0, 44); const bb = word.getBoundingBox();
  const W = 140 + (bb.x2 - bb.x1) + 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="120" viewBox="0 0 ${W} 120">
    <g transform="translate(0 4)">${mark()}</g>
    ${headline(['FAKE FANATIC'], { size: 44, x: 140 - bb.x1, bottom: 78, colors: [[C.navy, C.orange]] })}</svg>`;
  await sharp(Buffer.from(svg)).resize({ width: 560 }).png({ compressionLevel: 9, palette: true }).toFile(path.join(emailDir, 'logo.png'));
}

await banner('welcome.jpg', 'confused-fan.png', ["YOU'RE ON", 'THE LIST.'], { pill: 'THIS IS YOU. FOR NOW.', focus: 'top', size: 104 });
await banner('weekly.jpg', 'lp-stadium-night.jpg', ["THIS WEEK'S", 'CHEAT SHEET'], { pill: 'FREE EVERY TUESDAY', size: 100 });
await banner('super-bowl.jpg', 'confused-fan.png', ['SUPER BOWL PARTY', 'SURVIVAL GUIDE'], { pill: 'SUNDAY, FEB 14', crop: { left: 600, top: 0, width: 776, height: 440 }, size: 84 });
console.log('Email images written.');
