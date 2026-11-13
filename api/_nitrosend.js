// Nitrosend hook. Filled in at step 3; until NITROSEND_API_KEY is set it does nothing.
// (Files in /api starting with _ are helpers, not public endpoints.)
export async function onNewSignup({ email, referralCode, referralLink, source, referredBy }) {
  if (!process.env.NITROSEND_API_KEY) return;
}
