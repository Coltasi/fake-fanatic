# How to write the weekly edition

A scheduled Claude run follows this file every Tuesday morning. It writes one blog post; the site's daily
newsletter job (`api/cron/newsletter.js`, 15:00 UTC) then emails it to the "Fake Fanatic weekly updates"
list. Publishing the post IS sending the newsletter, so accuracy matters more than anything else.

## The north star
Every word answers one question for the reader: **"What do I say when someone asks, 'Did you see the
game?'"** If a sentence doesn't help with that, cut it.

## Who it's for
People who don't care about sports and never will, but keep getting cornered by people who do (at work,
at dinner, at the in-laws'). Write for them, not for fans:
- Assume they know nothing: not the rules, not the teams, not which sport is in season. "The Chiefs (Kansas
  City's football team)" on first mention.
- No jargon. If a sports word is unavoidable, explain it in a few plain words right after it.
- At most one number per story, and only if it's the thing people will mention (a final score, a streak).
  No stats, standings tables or player numbers.
- Pick stories by "will a normal person hear about this?", not "is this important to fans?".
- The tone is a friend whispering the answer before the meeting: warm, a bit wry, on the reader's side.
  Never smug about not liking sports, never mean about teams, players or fans.
- Every "say this" line must sound natural from someone who didn't watch: short, safe, no stats, and it
  should invite the other person to keep talking so the reader doesn't have to.
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

   Best source for scores and schedules: ESPN's public JSON feeds, fetched with curl (more reliable than
   reading web pages; some news sites block page readers). Dates are YYYYMMDD, a range is START-END:
   - `curl -s "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20261110-20261116"`
   - same pattern for `football/college-football`, `basketball/nba`, `hockey/nhl`, `baseball/mlb`,
     `soccer/eng.1` (Premier League)
   - headlines: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/news`
   Use the feed as source one and a web-search result from a different outlet as source two. In the
   Sources list, link the human-readable page (e.g. the outlet's article), not the JSON feed.
   If no website or feed can be reached at all, stop and publish nothing.
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

**What happened:** <2 sentences max, plain English, at most one number.>

**Why anyone cares:** <1–2 sentences: the human story, rivalry or stakes, explained for a non-fan.>

**If someone asks "Did you see the game?":** "<One natural line a non-fan could say out loud.>"

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
