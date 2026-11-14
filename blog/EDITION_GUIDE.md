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
1. Use today's date in UTC (YYYY-MM-DD). If any `blog/<that date>-*.md` already exists, stop: nothing to do.
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
5. Create `blog/<date>-<slug>.md`, where `<slug>` is 3–6 lowercase words with hyphens naming the
   biggest story people will search for, e.g. `2026-11-17-chiefs-bills-what-to-say`. Use exactly this shape:

```
---
title: <max 60 characters. Lead with the names people will search (teams, event), then the promise.
       e.g. "Chiefs vs. Bills: what to say if someone asks">
description: <140–155 characters for Google: the week's biggest stories by name plus "what to say">
preheader: <max 90 characters, the email preview line; different words from the subject>
subject: <email subject, max 45 characters>
keywords: <comma-separated: full team names, leagues, events, players mentioned>
date: <YYYY-MM-DD>
---

**Quick answer:** <1–2 sentences that answer "what's everyone talking about this week?" with full names
and the day, e.g. "The Kansas City Chiefs beat the Buffalo Bills on Sunday night. If someone asks, ...">

## <Story 1 as the question people type, e.g. "What happened in the Chiefs vs. Bills game?">

**What happened:** <first sentence directly answers the heading, with full team names (city + name) and
the day. 2 sentences max, plain English, at most one number.>

**Why anyone cares:** <1–2 sentences: the human story, rivalry or stakes, explained for a non-fan.>

**If someone asks "Did you see the game?":** "<One natural line a non-fan could say out loud.>"

## <Story 2 …same three lines…>

## <Story 3 …>

## What's coming up this weekend?

- <Day: matchup or event (full names), one short reason it matters>
- <2–3 bullets, each confirmed on an official schedule>

<!-- sources -->

## Quick questions

### <A question a non-fan would actually ask a search engine or chatbot this week, with names>

<1–2 sentence direct answer.>

### <Question 2>

<Answer.>

### <Question 3>

<Answer.>

## Sources

- [<Outlet: headline>](<url>)
- <one link per fact-bearing story, at least one per story>
```

Search and answer-engine rules (SEO + AEO):
- Answer first. Every heading is a question or a plain statement, and the very next sentence answers it.
  Answer engines quote the first sentence after a heading, so it must make sense on its own.
- Use full, unambiguous names on first mention: "the Kansas City Chiefs (NFL)", "Premier League club
  Arsenal". Include the day and date for anything time-specific.
- The "Quick questions" (### headings) become FAQ markup that Google and AI assistants can quote. Write
  them the way people ask: "Who won the Chiefs game?", "Why is everyone talking about Arsenal?".
- When a story fits an existing guide in `guides/` (e.g. the Super Bowl party guide), link to it once.
- Don't reuse a previous edition's title. Keep it honest: no clickbait the post doesn't deliver.
- The non-fan north star still wins: never add jargon or stats for the sake of keywords.

Only use headings (##, and ### under "Quick questions"), paragraphs, **bold**, *italics*, bullet lists and
links. No tables, images, block quotes or HTML: the same text becomes the email. Everything above
`<!-- sources -->` is emailed; "Quick questions" and the sources list appear only on the blog.

6. Check it: run `npm install` (first time) and `npm run build`. The build must succeed and
   `dist/blog/latest.json` must show the new post's slug.
7. Commit only the new file, with the message `Weekly edition: <title>`, and push to `main`.
   Don't change any other file. If anything above fails, don't push anything.
