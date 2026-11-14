// Nitrosend helpers for /api/waitlist. This file never sends email itself.
//   - Everyone who signs up joins the "Fake Fanatic waitlist" list. Joining it triggers the
//     welcome flow and is the audience for the launch email.
//   - People who tick "weekly Fake Fanatic updates" also join the "Fake Fanatic weekly updates"
//     list. Weekly emails go to that list only.
// (Files in /api starting with _ are helpers, not public endpoints.)
const API = 'https://api.nitrosend.com/v1/my';
const WAITLIST_LIST_ID = Number(process.env.NITROSEND_LIST_ID || 13477);
const WEEKLY_LIST_ID = Number(process.env.NITROSEND_WEEKLY_LIST_ID || 13496);

async function call(path, body, idempotencyKey) {
  const headers = { Authorization: `Bearer ${process.env.NITROSEND_API_KEY}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(API + path, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Nitrosend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function onNewSignup({ email, referralCode, referralLink, source, referredBy, weekly }) {
  if (!process.env.NITROSEND_API_KEY) return;
  await call('/contacts', {
    email,
    opt_in: true,
    list_ids: weekly ? [WAITLIST_LIST_ID, WEEKLY_LIST_ID] : [WAITLIST_LIST_ID],
    data: {
      referral_code: referralCode,
      referral_link: referralLink,
      source,
      referred_by: referredBy || '',
      weekly_updates: Boolean(weekly),
    },
  }, `waitlist-${referralCode}`);
}

// Someone already on the waitlist ticked the weekly box on a later visit.
export async function onWeeklyOptIn({ email }) {
  if (!process.env.NITROSEND_API_KEY) return;
  await call(`/lists/${WEEKLY_LIST_ID}/contacts/bulk`, { action: 'add', emails: [email] });
}
