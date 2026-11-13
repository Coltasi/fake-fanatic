// Adds a new waitlist signup to Nitrosend.
// Joining the "Fake Fanatic waitlist" list is what triggers the welcome email
// (the "Fake Fanatic: welcome to the waitlist" flow in Nitrosend), so this file never sends email itself.
// (Files in /api starting with _ are helpers, not public endpoints.)
const API = 'https://api.nitrosend.com/v1/my';
const WAITLIST_LIST_ID = Number(process.env.NITROSEND_LIST_ID || 13477);

export async function onNewSignup({ email, referralCode, referralLink, source, referredBy }) {
  const key = process.env.NITROSEND_API_KEY;
  if (!key) return;

  const res = await fetch(`${API}/contacts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `waitlist-${referralCode}`,
    },
    body: JSON.stringify({
      email,
      opt_in: true,
      list_ids: [WAITLIST_LIST_ID],
      data: {
        referral_code: referralCode,
        referral_link: referralLink,
        source,
        referred_by: referredBy || '',
      },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Nitrosend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
