// POST /api/waitlist
// Body: { email, weekly_updates?, referred_by?, utm_source?, utm_medium?, utm_campaign?, landing_path?, ff_hp? (honeypot) }
// Returns: { ok, referral_link, position }
//
// Env vars (Vercel → Settings → Environment Variables):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL, IP_HASH_SALT, NITROSEND_API_KEY
import crypto from 'node:crypto';
import { onNewSignup, onWeeklyOptIn } from './_nitrosend.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_RE = /^[A-Z0-9]{4,12}$/;

const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const SITE_URL = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ ok: false, error: 'Signups open in a few days. Check back soon!' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'Please enter your email.' });

  // Honeypot: bots fill every field. Pretend it worked and store nothing.
  if (clean(body.ff_hp)) {
    console.warn('waitlist honeypot tripped, signup discarded'); // no email logged; a spike here means real people are being dropped
    return res.status(200).json({ ok: true, referral_link: `${SITE_URL}/`, position: null });
  }

  const email = clean(body.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'That email doesn\'t look right. Try again?' });

  const referredBy = clean(body.referred_by, 12).toUpperCase();
  const landing = clean(body.landing_path, 300);
  const ip = clean(String(req.headers['x-forwarded-for'] || '').split(',')[0]) || clean(req.headers['x-real-ip']) || '';
  const ipHash = ip ? crypto.createHash('sha256').update((process.env.IP_HASH_SALT || 'ff') + ip).digest('hex') : null;
  const country = clean(req.headers['x-vercel-ip-country'], 8) || null;

  const args = {
    p_email: email,
    p_referred_by: CODE_RE.test(referredBy) ? referredBy : null,
    p_source: clean(body.utm_source, 100) || 'direct',
    p_utm_medium: clean(body.utm_medium, 100) || null,
    p_utm_campaign: clean(body.utm_campaign, 100) || null,
    p_landing_path: landing.startsWith('/') ? landing : null,
    p_ip_country: country,
    p_ip_hash: ipHash,
    p_weekly: body.weekly_updates === true,
  };

  let row;
  try {
    const key = SUPABASE_SERVICE_ROLE_KEY;
    const headers = { 'Content-Type': 'application/json', apikey: key };
    if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`; // legacy JWT-style keys
    const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/join_waitlist`, {
      method: 'POST', headers, body: JSON.stringify(args),
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    [row] = await r.json();
  } catch (err) {
    console.error('waitlist insert failed', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong on our end. Please try again in a minute.' });
  }

  if (row.r_rate_limited) return res.status(429).json({ ok: false, error: 'Too many tries. Give it a few minutes.' });

  const referralLink = `${SITE_URL}/r/${row.r_code}`;

  // New signups go to Nitrosend (contact + welcome email); existing ones who now tick the weekly box
  // join the weekly list. Failures are logged, never shown to the visitor.
  try {
    if (row.r_is_new) {
      await onNewSignup({ email, referralCode: row.r_code, referralLink, source: args.p_source, referredBy: args.p_referred_by, weekly: args.p_weekly });
    } else if (row.r_weekly_added) {
      await onWeeklyOptIn({ email });
    }
  } catch (err) {
    console.error('nitrosend failed', err);
  }

  // Same response whether the email is new or already on the list.
  return res.status(200).json({ ok: true, referral_link: referralLink, position: Number(row.r_position) || null });
}
