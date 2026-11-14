// Builds the static site into dist/.
//
//   src/partials/*.html   shared pieces (head, nav, footer, signup form...)
//   src/pages/*.html      page bodies (index, 404, r)
//   content/*.md          About and Privacy copy
//   guides/*.md           search-friendly articles (files starting with _ are skipped)
//   public/               copied as-is; images in public/img are compressed to WebP
//
// Template tags you can use in any page or partial:
//   {{name}}                         a variable (title, description, year...)
//   {{> partial key="value"}}        insert src/partials/partial.html
//   {{img name="hero" alt="..." sizes="100vw" eager}}  responsive image
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { marked } from 'marked';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://www.fakefanatic.com').replace(/\/$/, '');

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });

// ---------- images ----------
// For every PNG/JPG in public/img we write WebP copies at a few widths.
// Icons and og.png are used as-is. A missing image stops the build with a clear message.
const IMG_WIDTHS = { hero: [640, 960, 1376], default: [340, 680] };
const AS_IS = /^(og|favicon.*|apple-touch-icon)$/;
const images = {};
const imgDir = path.join(root, 'public/img');
for (const file of fs.readdirSync(imgDir)) {
  const m = file.match(/^(.+)\.(png|jpe?g)$/i);
  if (!m || AS_IS.test(m[1])) continue;
  const name = m[1];
  const src = path.join(imgDir, file);
  const meta = await sharp(src).metadata();
  const widths = (IMG_WIDTHS[name] || IMG_WIDTHS.default).filter((w) => w <= meta.width);
  if (!widths.length) widths.push(meta.width);
  for (const w of widths) {
    await sharp(src).resize({ width: w }).webp({ quality: 74 }).toFile(path.join(dist, 'img', `${name}-${w}.webp`));
  }
  images[name] = { src: `/img/${file}`, width: meta.width, height: meta.height, widths };
}

function imgTag({ name, alt = '', sizes = '300px', eager, load = 'lazy', cls = '' }) {
  const im = images[name];
  // eager = the main above-the-fold image; load="now" = visible on load but not the main one; default = lazy
  const loading = eager !== undefined ? 'fetchpriority="high"' : load === 'now' ? 'decoding="async"' : 'loading="lazy" decoding="async"';
  const klass = cls ? ` class="${cls}"` : '';
  if (!im) throw new Error(`Missing image: add public/img/${name}.png`);
  const srcset = im.widths.map((w) => `/img/${name}-${w}.webp ${w}w`).join(', ');
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${sizes}">` +
    `<img${klass} src="${im.src}" alt="${alt}" width="${im.width}" height="${im.height}" ${loading}></picture>`;
}

// ---------- templating ----------
const partials = {};
for (const f of fs.readdirSync(path.join(root, 'src/partials'))) {
  partials[f.replace(/\.(html|svg)$/, '')] = fs.readFileSync(path.join(root, 'src/partials', f), 'utf8').trim();
}
const parseArgs = (s = '') => {
  const out = {};
  for (const m of s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) out[m[1]] = m[2] ?? '';
  return out;
};
function render(tpl, vars, depth = 0) {
  if (depth > 10) throw new Error('Partials nested too deeply');
  return tpl
    .replace(/\{\{>\s*([\w-]+)([^}]*)\}\}/g, (_, name, args) => {
      if (!(name in partials)) throw new Error(`Unknown partial: ${name}`);
      return render(partials[name], { ...vars, ...parseArgs(args) }, depth + 1);
    })
    .replace(/\{\{([\w-]+)\}\}/g, (m, k) => (k in vars ? vars[k] : m))
    .replace(/\{\{img\s+([^}]*)\}\}/g, (_, args) => imgTag(parseArgs(args)));
}

// Front matter: a block of `key: value` lines between --- at the top of a file.
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
  }
  return { data, body: text.slice(m[0].length) };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const version = crypto.createHash('sha1')
  .update(fs.readFileSync(path.join(root, 'public/css/site.css')))
  .update(fs.readFileSync(path.join(root, 'public/js/site.js')))
  .digest('hex').slice(0, 8);

const sitemap = [];
function writePage(urlPath, file, body, meta) {
  const vars = {
    year: new Date().getFullYear(),
    version,
    siteUrl: SITE_URL,
    title: 'Fake Fanatic: survive sports small talk',
    description: 'Fake Fanatic is the app for people who don\'t follow sports. Get the score, the one moment that mattered and a line to say, so you can survive sports small talk.',
    ogImage: `${SITE_URL}/img/og.png`,
    robots: '',
    jsonld: '',
    preload: '',
    load: 'lazy',
    bodyClass: '',
    ...meta,
  };
  vars.canonical = SITE_URL + (urlPath === '/' ? '/' : urlPath);
  vars.title = esc(vars.title);
  vars.description = esc(vars.description);
  const html = render(partials.layout, { ...vars, content: render(body, vars) });
  const out = path.join(dist, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  if (!meta.noindex) sitemap.push(vars.canonical);
}

// ---------- pages ----------
const heroPreload = images.hero
  ? `<link rel="preload" as="image" type="image/webp" imagesrcset="${images.hero.widths.map((w) => `/img/hero-${w}.webp ${w}w`).join(', ')}" imagesizes="100vw" fetchpriority="high">`
  : '';
const homeJsonLd = `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Fake Fanatic',
  url: SITE_URL + '/',
  logo: SITE_URL + '/img/favicon-512.png',
  email: 'support@fakefanatic.com',
})}</script>`;

writePage('/', 'index.html', fs.readFileSync(path.join(root, 'src/pages/index.html'), 'utf8'),
  { preload: heroPreload, jsonld: homeJsonLd, bodyClass: 'home' });
writePage('/404', '404.html', fs.readFileSync(path.join(root, 'src/pages/404.html'), 'utf8'),
  { title: 'Page not found | Fake Fanatic', noindex: true, robots: '<meta name="robots" content="noindex">' });
writePage('/r', 'r.html', fs.readFileSync(path.join(root, 'src/pages/r.html'), 'utf8'),
  { title: 'Fake Fanatic', noindex: true, robots: '<meta name="robots" content="noindex">' });

// About + Privacy from Markdown
for (const [slug, fallbackTitle] of [['about', 'About'], ['privacy', 'Privacy policy']]) {
  const { data, body } = frontMatter(fs.readFileSync(path.join(root, `content/${slug}.md`), 'utf8'));
  writePage(`/${slug}`, `${slug}.html`, partials['content-page'], {
    title: `${data.title || fallbackTitle} | Fake Fanatic`,
    description: data.description,
    heading: esc(data.heading || data.title || fallbackTitle),
    kicker: esc(data.kicker || ''),
    body: marked.parse(body),
    bodyClass: `page-${slug}`,
  });
}

// Guides
const guideDir = path.join(root, 'guides');
const guides = [];
for (const f of fs.readdirSync(guideDir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort()) {
  const { data, body } = frontMatter(fs.readFileSync(path.join(guideDir, f), 'utf8'));
  if (data.draft === 'true') continue;
  const slug = f.replace(/\.md$/, '');
  guides.push({ slug, ...data });
  const articleLd = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.description,
    datePublished: data.date,
    author: { '@type': 'Organization', name: 'Fake Fanatic' },
    publisher: { '@type': 'Organization', name: 'Fake Fanatic', logo: SITE_URL + '/img/favicon-512.png' },
    mainEntityOfPage: `${SITE_URL}/guides/${slug}`,
  })}</script>`;
  writePage(`/guides/${slug}`, `guides/${slug}.html`, partials['guide-page'], {
    title: `${data.title} | Fake Fanatic`,
    description: data.description,
    heading: esc(data.title),
    kicker: esc(data.kicker || 'Guide'),
    dek: esc(data.dek || data.description || ''),
    date: data.date || '',
    body: marked.parse(body),
    jsonld: articleLd,
    bodyClass: 'page-guide',
  });
}
const guideList = guides.map((g) =>
  `<li><a href="/guides/${g.slug}"><span class="guide-card__kicker">${esc(g.kicker || 'Guide')}</span><span class="guide-card__title">${esc(g.title)}</span><span class="guide-card__dek">${esc(g.description || '')}</span></a></li>`).join('\n');
writePage('/guides', 'guides/index.html', partials['guides-index'], {
  title: 'Guides: how to talk sports without watching | Fake Fanatic',
  description: 'Short, plain-English guides for people who don\'t follow sports: what to say at a Super Bowl party, how to talk football at work, and more.',
  guideList,
  bodyClass: 'page-guide',
});

// Blog: the weekly newsletter editions. blog/YYYY-MM-DD-slug.md, newest first.
// Everything above a "<!-- sources -->" line goes into the email; the sources list is blog-only.
const blogDir = path.join(root, 'blog');
const posts = [];
for (const f of fs.readdirSync(blogDir).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f)).sort().reverse()) {
  const { data, body } = frontMatter(fs.readFileSync(path.join(blogDir, f), 'utf8'));
  if (data.draft === 'true') continue;
  const slug = f.replace(/\.md$/, '');
  const [emailPart] = body.split(/^<!--\s*sources\s*-->$/m);
  const html = marked.parse(body.replace(/^<!--\s*sources\s*-->$/m, ''));
  const date = data.date || slug.slice(0, 10);
  const pretty = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  posts.push({ slug, ...data, date, pretty, emailHtml: marked.parse(emailPart) });
  writePage(`/blog/${slug}`, `blog/${slug}.html`, partials['blog-page'], {
    title: `${data.title} | Fake Fanatic`,
    description: data.description,
    heading: esc(data.title),
    kicker: esc(`Week of ${pretty}`),
    dek: esc(data.description || ''),
    body: html,
    jsonld: `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: data.title, description: data.description,
      datePublished: date, author: { '@type': 'Organization', name: 'Fake Fanatic' },
      publisher: { '@type': 'Organization', name: 'Fake Fanatic', logo: SITE_URL + '/img/favicon-512.png' },
      mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
    })}</script>`,
    bodyClass: 'page-guide',
  });
}
const postList = posts.length
  ? posts.map((p) => `<li><a href="/blog/${p.slug}"><span class="guide-card__kicker">Week of ${esc(p.pretty)}</span><span class="guide-card__title">${esc(p.title)}</span><span class="guide-card__dek">${esc(p.description || '')}</span></a></li>`).join('\n')
  : '<li class="blog-empty">The first edition lands on a Tuesday soon. Tick "weekly updates" below to get it by email.</li>';
writePage('/blog', 'blog/index.html', partials['blog-index'], {
  title: 'This week in sports, in plain English | Fake Fanatic',
  description: 'A weekly, plain-English rundown of what is happening across the sports leagues, with one line you can actually say. Also sent as the Fake Fanatic newsletter.',
  postList,
  bodyClass: 'page-guide',
});
// Machine-readable latest edition for the Tuesday newsletter sender (api/cron/newsletter.js).
fs.writeFileSync(path.join(dist, 'blog', 'latest.json'), JSON.stringify(posts[0] ? {
  slug: posts[0].slug, date: posts[0].date, title: posts[0].title, subject: posts[0].subject || posts[0].title,
  preheader: posts[0].description || '', url: `${SITE_URL}/blog/${posts[0].slug}`, html: posts[0].emailHtml,
} : null));

// ---------- sitemap + robots ----------
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  sitemap.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /r/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Built ${sitemap.length} indexable pages into dist/ (version ${version}).`);
