// GET /api/status: a quick health check for the public /status page.
// Checks the database (Supabase) and the email service (Nitrosend), and reports the
// latest weekly newsletter send. Never returns keys, emails or error details.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NITROSEND_API_KEY (same as /api/waitlist).
const NS = 'https://api.nitrosend.com/v1/my';
const WAITLIST_LIST_ID = Number(process.env.NITROSEND_LIST_ID || 13477);

async function checkDatabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!SUPABASE_URL || !key) return { ok: false, newsletter: null };
  const headers = { apikey: key };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/newsletter_sends?select=slug,status,created_at&order=created_at.desc&limit=1`,
    { headers, signal: AbortSignal.timeout(5000) });
  if (!r.ok) return { ok: false, newsletter: null };
  const [last] = await r.json();
  return { ok: true, newsletter: last ? { slug: last.slug, status: last.status, at: last.created_at } : null };
}

async function checkEmail() {
  if (!process.env.NITROSEND_API_KEY) return false;
  const r = await fetch(`${NS}/lists/${WAITLIST_LIST_ID}`, {
    headers: { Authorization: `Bearer ${process.env.NITROSEND_API_KEY}` },
    signal: AbortSignal.timeout(5000),
  });
  return r.ok;
}

export default async function handler(req, res) {
  // Cached for a minute at the edge so the page can't be used to hammer the services.
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
  const [db, email] = await Promise.allSettled([checkDatabase(), checkEmail()]);
  const database = db.status === 'fulfilled' ? db.value : { ok: false, newsletter: null };
  if (db.status === 'rejected') console.error('status: database check failed', db.reason);
  if (email.status === 'rejected') console.error('status: email check failed', email.reason);
  return res.status(200).json({
    ok: true,
    checked_at: new Date().toISOString(),
    signups: database.ok,
    email: email.status === 'fulfilled' && email.value === true,
    newsletter: database.newsletter,
  });
}
