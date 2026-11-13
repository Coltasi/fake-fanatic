# Fake Fanatic: waitlist site

Plain HTML/CSS/JS, built by a small script and hosted on Vercel.

## Where things live

| To change… | Edit |
| --- | --- |
| Landing page copy | `src/pages/index.html` |
| Nav, footer, signup form, final orange band | `src/partials/nav.html`, `footer.html`, `signup.html`, `join-band.html` |
| About / Privacy copy | `content/about.md`, `content/privacy.md` (plain Markdown) |
| Colours, fonts, spacing | top of `public/css/site.css` |
| Form behaviour, success card, share text | `public/js/site.js` |
| Images | `public/img/` (see below) |

Edit a file on GitHub (pencil icon) and commit: Vercel rebuilds and publishes in about a minute.

## Images

Drop PNGs into `public/img/` with exactly these names. Export at 2x. The build makes compressed WebP copies automatically.

- `hero.png`: crowd photo (WebP copies are made automatically)
- `screen-home.png`, `screen-cheatsheet.png`, `screen-team.png`, `screen-people.png`: phone screenshots, 680 × 1400 px. Shown from the top, cropped to the phone frame.
- `og.png`: link-preview image, 1200 × 630 px
- `favicon.ico`, `favicon-32.png`, `favicon-512.png`, `apple-touch-icon.png`: site icons

To replace one, overwrite the file with the same name. If a required image is missing, the build stops and names it.

## Add a guide

1. Copy `guides/_template.md` to a new file, e.g. `guides/how-to-talk-about-football-at-work.md`. The file name becomes the URL.
2. Fill in the top section (title, description, date), delete `draft: true`, and write the guide.
3. Commit. It appears at `/guides/<file-name>`, on the `/guides` page and in `sitemap.xml`. The waitlist form is added at the bottom automatically.

## Find signups

Supabase → your project → **Table Editor** → `waitlist`. Use the **referral_counts** view to see who has referred the most people. To export, click the table, then **Export → CSV**.

## Run it locally (optional)

```
npm install
npm run dev        # http://localhost:3000
```

Secrets (Supabase, Nitrosend keys) live only in Vercel → Project → Settings → Environment Variables. See `.env.example` for the names.

## Emails (Nitrosend)

Everything lives in the **Fake Fanatic** brand in Nitrosend and goes only to the **Fake Fanatic waitlist** list. New signups are added to that list automatically by `/api/waitlist`.

| Email | Where in Nitrosend | How it sends |
| --- | --- | --- |
| Welcome | Flows → "Fake Fanatic: welcome to the waitlist" | Automatically when someone joins the list (once approved) |
| Weekly cheat sheet | Templates → "Weekly pre-launch cheat sheet" | Each week: Campaigns → New → use this template → fill in the [BRACKETS] → audience: Fake Fanatic waitlist → schedule Tuesday |
| Super Bowl special | Campaigns → "Super Bowl special…" | Fill in the teams by Feb 1, then schedule for Tue Feb 9, 2027 |

Merge tags: `{{ data.referral_link }}`, `{{ data.referral_code }}`. The footer adds the mailing address and unsubscribe link automatically. The source copy of each email is in `emails/*.json`.
