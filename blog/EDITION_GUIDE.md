# How to write the weekly edition

A scheduled Claude run follows this file every Tuesday morning. It writes one blog post; the site's daily
newsletter job (`api/cron/newsletter.js`, 15:00 UTC) then emails it to the "Fake Fanatic weekly updates"
list. Publishing the post IS sending the newsletter, so accuracy matters more than anything else.

## Who it's for
People who don't follow sports but keep ending up in conversations about them. Plain English, no jargon
without a two-word explanation, light and friendly humor, never mean about teams, players or fans.
Nothing is tailored to the reader: it's the same high-level rundown for everyone.

## Steps
1. Use today's date in UTC (YYYY-MM-DD). If `blog/<that date>-*.md` already exists, stop: nothing to do.
2. Research the last 7 days of sports news with web search. Cover what's in season and widely talked about
   in the US: NFL and college football (Sept–Feb), NBA, NHL, MLB (Mar–Oct), Premier League / big soccer,
   and golf or tennis majors when they happen. Pick the 3–4 stories most likely to come up at work or at
   dinner this week, from at least 2 different sports.
3. Facts: use reputable outlets only (league sites, AP, Reuters, ESPN, CBS Sports, BBC Sport, NBC Sports,
   The Athletic). Every score, record or stat must be confirmed in two sources. If you can't confirm it,
   leave it out. No rumors, no injury speculation, no betting or gambling content.
4. Write in your own words. Never copy sentences from articles; quote at most a few words from a person.
5. Create `blog/<date>-week-in-sports.md` in exactly this shape:

```
---
title: <catchy headline for the week, max 60 characters>
subject: <email subject line, max 45 characters>
description: <one-sentence teaser, max 90 characters; used as the email preheader and page summary>
date: <YYYY-MM-DD>
---

<One or two sentences setting up the week.>

## <Story 1 headline in plain English>

**What happened:** <2 sentences max.>

**Why people care:** <1–2 sentences.>

**Say this:** "<One line someone could say out loud.>"

## <Story 2 …same three lines…>

## <Story 3 …>

## Coming up this weekend

- <Day: matchup or event, one short reason it matters>
- <2–3 bullets, each confirmed on an official schedule>

<!-- sources -->

## Sources

- [<Outlet: headline>](<url>)
- <one link per fact-bearing story, at least one per story>
```

Only use headings (##), paragraphs, **bold**, *italics*, bullet lists and links. No tables, images,
block quotes or HTML: the same text becomes the email. Everything above `<!-- sources -->` is emailed;
the sources list appears only on the blog.

6. Check it: run `npm install` (first time) and `npm run build`. The build must succeed and
   `dist/blog/latest.json` must show the new post's slug.
7. Commit only the new file, with the message `Weekly edition: <title>`, and push to `main`.
   Don't change any other file. If anything above fails, don't push anything.
