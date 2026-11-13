// One-off generator for the FF logo mark, favicons and the share image (og.png).
// Run with: npm run brand
// It downloads the two open-source fonts (Kaushan Script, Graduate), turns the
// letters into SVG paths, and writes:
//   src/partials/logo-mark.svg      inline logo used in the nav and footer
//   public/favicon.svg, public/favicon-32.png, public/apple-touch-icon.png
//   public/img/og.png               only if you haven't added your own
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

// Favicon / app icon: navy rounded square, orange over cream.
const iconInner = mark({ ground: C.navy, back: C.orange, front: C.cream, edge: C.cream, shadow: false });
const icon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}">` +
  `<rect width="120" height="120" rx="26" fill="${C.navy}"/><g transform="translate(-2 -2)">${iconInner}</g></svg>`;
fs.writeFileSync(path.join(root, 'public/favicon.svg'), icon(120));
await sharp(Buffer.from(icon(32))).resize(32, 32).png().toFile(path.join(root, 'public/favicon-32.png'));
await sharp(Buffer.from(icon(180))).resize(180, 180).png().toFile(path.join(root, 'public/apple-touch-icon.png'));
await sharp(Buffer.from(icon(512))).resize(512, 512).png().toFile(path.join(root, 'public/icon-512.png'));

// Share image, 1200x630. Skipped if you've dropped in your own og.png.
const ogPath = path.join(root, 'public/img/og.png');
if (!fs.existsSync(ogPath) || process.argv.includes('--force-og')) {
  const t = (s, x, y, size, fill, shadowFill, anchor = 'start') => {
    const p = graduate.getPath(s, 0, 0, size);
    const bb = p.getBoundingBox();
    const w = bb.x2 - bb.x1;
    const dx = anchor === 'middle' ? x - w / 2 - bb.x1 : x - bb.x1;
    const d = graduate.getPath(s, dx, y, size).toPathData(2);
    const off = Math.max(2, Math.round(size / 28));
    return (shadowFill ? `<path d="${d}" fill="${shadowFill}" transform="translate(${off} ${off})"/>` : '') +
      `<path d="${d}" fill="${fill}"/>`;
  };
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${C.cream}"/>
  <rect y="0" width="1200" height="18" fill="${C.navy}"/><rect y="612" width="1200" height="18" fill="${C.navy}"/>
  <g transform="translate(60 50) scale(1.6)">${mark()}</g>
  ${t('FAKE', 600, 300, 150, C.navy, C.orange, 'middle')}
  ${t('FANATIC', 600, 460, 150, C.orange, C.navy, 'middle')}
  <rect x="300" y="500" width="600" height="70" rx="35" fill="${C.navy}"/>
  ${t('SURVIVE SPORTS SMALL TALK', 600, 548, 30, C.cream, null, 'middle')}
</svg>`;
  await sharp(Buffer.from(og)).png({ compressionLevel: 9, palette: true }).toFile(ogPath);
}
console.log('Brand assets written.');
