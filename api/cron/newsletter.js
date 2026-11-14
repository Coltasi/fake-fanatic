// GET /api/cron/newsletter: run by Vercel Cron once a day (see vercel.json).
// Sends the newest blog post as the weekly newsletter to the "Fake Fanatic weekly updates" list,
// once per post. Supabase table newsletter_sends records each send so nothing goes out twice.
//
// Env: CRON_SECRET (Vercel sends it as a Bearer token), NITROSEND_API_KEY, SUPABASE_URL,
//      SUPABASE_SERVICE_ROLE_KEY, SITE_URL. Optional NITROSEND_WEEKLY_LIST_ID.
// Manual test (with the secret): ?deliver_at=<ISO time> schedules instead of sending now;
// ?dry=1 builds everything except the campaign.
const NS = 'https://api.nitrosend.com/v1/my';
const WEEKLY_LIST_ID = Number(process.env.NITROSEND_WEEKLY_LIST_ID || 13496);
const MAX_AGE_DAYS = 6;

async function ns(method, path, body) {
  const res = await fetch(NS + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NITROSEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `${method}-${path}-${Date.now()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Nitrosend ${method} ${path} ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

async function db(method, query, body, prefer) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/newsletter_sends${query}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function emailSections(post, site) {
  return [
    { type: 'header', props: { variant: 'logo', logo_url: `${site}/email/logo.png`, logo_alt: 'Fake Fanatic', logo_width: 220 } },
    { type: 'image', props: { src: `${site}/email/weekly.jpg`, alt: "This week's cheat sheet", width: '600', href: post.url } },
    { type: 'text', props: { eyebrow: 'This week in sports', content: post.html } },
    { type: 'button', props: { text: 'Read it on the blog', href: post.url, border_radius: '999px', background_color: '#c4501d', text_color: '#ffffff' } },
    { type: 'footer', props: { unsubscribe_text: 'Unsubscribe (no hard feelings)' } },
  ];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const site = (process.env.SITE_URL || 'https://www.fakefanatic.com').replace(/\/$/, '');
  const dry = req.query?.dry === '1';
  const deliverAt = req.query?.deliver_at || undefined;

  // ?test=1&deliver_at=<far future>: exercise the Nitrosend path with sample content, no Supabase record.
  const test = req.query?.test === '1';
  if (test && !deliverAt) return res.status(400).json({ ok: false, error: 'test mode needs deliver_at' });
  const post = test
    ? { slug: 'test', date: new Date().toISOString().slice(0, 10), title: 'TEST edition (will be cancelled)', subject: 'TEST: do not send',
        preheader: 'Pipeline test', url: `${site}/blog`, html: '<h2>Test item</h2><p>This is a pipeline test and will be cancelled.</p>' }
    : await fetch(`${site}/blog/latest.json`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  if (!post) return res.status(200).json({ ok: true, skipped: 'no posts yet' });
  const ageDays = (Date.now() - Date.parse(post.date + 'T00:00:00Z')) / 86400000;
  if (ageDays > MAX_AGE_DAYS) return res.status(200).json({ ok: true, skipped: `latest post ${post.slug} is ${Math.floor(ageDays)} days old` });
  if (dry) return res.status(200).json({ ok: true, dry: true, slug: post.slug, subject: post.subject, sections: emailSections(post, site).length });

  // Claim the post. If the row already exists, it was sent (or is being sent): stop.
  if (!test) {
    const claimed = await db('POST', '?on_conflict=slug', { slug: post.slug }, 'resolution=ignore-duplicates,return=representation');
    if (!claimed || claimed.length === 0) return res.status(200).json({ ok: true, skipped: `${post.slug} already sent` });
  }

  try {
    const campaign = await ns('POST', '/campaigns', { name: `Weekly: ${post.title} (${post.date})`, channel: 'email' });
    const version = campaign.template?.version || 1;
    const updated = await ns('PATCH', `/campaigns/${campaign.id}`, {
      trigger_attributes: { audience_type: 'lists', contact_list_ids: [WEEKLY_LIST_ID] },
      template_attributes: {
        if_version: version, subject: post.subject, preheader: post.preheader,
        content_format: 'designed', design: { sections: emailSections(post, site) },
      },
    });
    await ns('POST', `/campaigns/${campaign.id}/send`, {
      expected_campaign_updated_at: updated.updated_at,
      template_if_version: updated.template?.version ?? version + 1,
      ...(deliverAt ? { deliver_at: deliverAt } : {}),
    });
    if (!test) await db('PATCH', `?slug=eq.${encodeURIComponent(post.slug)}`, { status: deliverAt ? 'scheduled' : 'sent', campaign_id: campaign.id });
    return res.status(200).json({ ok: true, sent: post.slug, campaign_id: campaign.id, scheduled: deliverAt || null });
  } catch (err) {
    console.error('newsletter send failed', err);
    // Release the claim so tomorrow's run retries.
    if (!test) await db('DELETE', `?slug=eq.${encodeURIComponent(post.slug)}`).catch(() => {});
    return res.status(500).json({ ok: false, error: String(err.message || err).slice(0, 500) });
  }
}
