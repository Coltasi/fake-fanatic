# Fake Fanatic waitlist site

Pre-launch waitlist site for Fake Fanatic (app for people who don't follow sports). Owner is non-technical: explain in plain, numbered steps; make technical decisions yourself; ask before paid resources, DNS changes or sending email.

Live: https://www.fakefanatic.com (bare domain 308s to www). Repo: github.com/Coltasi/fake-fanatic, pushes to `main` auto-deploy on Vercel (team `coltasa`, project `fake-fanatic`).

## How it's built
- Plain HTML/CSS/vanilla JS + a tiny Node build (`npm run build` → `dist/`). No framework.
- `src/pages/index.html` landing page; `src/pages/status.html` + `api/status.js` → /status (live checks of Supabase, Nitrosend, last newsletter send; noindex); `src/partials/*` shared nav/footer/signup/badges/phone frame/layout head.
- Template tags: `{{var}}`, `{{> partial key="val"}}`, `{{img name="x" alt="..." sizes="..." eager|load="now"}}` (WebP srcset + PNG fallback; missing image = build error).
- `content/about.md`, `content/privacy.md` → /about, /privacy. `guides/*.md` (front matter; `_template.md` skipped) → /guides/<slug>, plus sitemap.
- `public/css/site.css` (brand tokens at top), `public/js/site.js` (forms, success card, UTM + `ff_ref` cookie, "Join" buttons scroll to nearest form).
- Images in `public/img/` are owner-supplied except favicons/og.png (`npm run icons`). `scripts/make-brand-assets.js` (old brand) makes the old logo SVG and `public/email/*` banners.
- Check changes: `npm run build`, serve `dist/` locally, screenshot at 375/768/1280. Lighthouse mobile was 91–98 perf, 100 a11y/BP/SEO; keep it 90+.

## Brand rules
Copy north star (site, emails, blog): write for people who don't care about sports and answer "What do I say when someone asks 'Did you see the game?'" Plain English, no jargon, no stats.
Ink #191B19 (text, dark sections, outlines), stone #EAE5DA (page), ivory #FBF8EF (cards, inputs), coral #F2836B / hover #E8705A is the ONLY accent (primary buttons, link underlines, small bars). Never coral text on a light background; text on coral is always ink. Muted #535A53 secondary text, line #C9C3B6 hairlines, soft #D9D6CC secondary text on ink. DM Serif Display 400 headlines (sentence case, -0.02em), DM Sans 400/500/700 body. 8px radius controls, 12px cards, 1px borders, no offset shadows, grayscale photos. Logo is the plain "Fake Fanatic" wordmark in DM Serif Display; favicon is a white serif "FF" on a coral tile. Focus ring 2px ink, 3px offset (ivory on ink sections, `.on-ink`). Phone mockups are HTML partials (`src/partials/screen-*.html`), not screenshots. `npm run icons` regenerates favicons + og.png. `public/email/*` and the Nitrosend templates still use the old navy/orange brand.

## Backend
- `api/waitlist.js` → Supabase RPC `join_waitlist` (schema in `supabase/schema.sql`; project ref `oosvkgeaxotgueuhuumq`; RLS on, service key only). Same response for new/existing emails; honeypot `ff_hp` (display:none, no label; was `company`, which browsers auto-filled and silently dropped real signups); 8 attempts/IP/10 min.
- `api/_nitrosend.js` adds new signups to Nitrosend list 13477 ("Fake Fanatic waitlist"; triggers live welcome flow 19341; launch email audience). Signups who tick the unticked-by-default "weekly updates" box (`weekly_updates` column) also join list 13496 ("Fake Fanatic weekly updates"); existing signups who tick it later are added via the list bulk endpoint. Weekly/marketing emails go to 13496 only.
- Owner removed referral promotion: success card is a plain confirmation and emails carry no referral links. Referral codes/`/r/` links still exist in the backend but aren't promoted.
- Nitrosend brand "Fake Fanatic" (sid 28996e1198ecd63a7160d982). Sender hello@fakefanatic.nitrosend.net (free plan), reply-to hello@fakefanatic.com. Safe Mode is on: the owner must click Go live / send. Weekly template 28789 and Super Bowl campaign 16772 (audience: list 13496) are drafts. Nitrosend is the source of truth for email content; `emails/*.json` are early copies and may be stale. The separate "Coltasa" brand and coltasa.com domain must not be touched.
- Secrets live only in Vercel env vars (see `.env.example`). Never commit keys; `.nitrosend-key` / `.cloudflare-token` are gitignored scratch files.
- DNS is at Cloudflare: www + @ CNAME → Vercel (proxy off), MX/SPF for Cloudflare Email Routing, DMARC p=none, Google site verification TXT (keep it).

## Weekly newsletter + blog (fully automatic, owner turned off Nitrosend Safe Mode)
- Writer: claude.ai routine "Fake Fanatic weekly edition" (trig_01MCu7ufwtJP4P7yXKAcLhuW), Tuesdays 12:00 UTC, no connectors, cloud env network = Full. Follows `blog/EDITION_GUIDE.md`, adds one `blog/YYYY-MM-DD-<keyword-slug>.md` (SEO/AEO rules in the guide) and pushes to main. Edit the guide (not the routine) to change tone, sports or format.
- Blog: `blog/*.md` → /blog and /blog/<slug>; build writes `dist/blog/latest.json`. Text above `<!-- sources -->` is the email; "Quick questions" (### → FAQPage schema) and sources are blog-only. Posts get BlogPosting + FAQPage + BreadcrumbList JSON-LD, og:type article, RSS at /blog/rss.xml.
- Sender: Vercel cron `api/cron/newsletter.js` daily 15:00 UTC (CRON_SECRET). Sends latest post (≤6 days old) once to Nitrosend list 13496; `newsletter_sends` table in Supabase prevents repeats; failure releases the claim so the next day retries. Test with `?test=1&deliver_at=<future>` then cancel the campaign.
