// Placeholder until Supabase is connected (step 2 replaces this file).
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  return res.status(503).json({ ok: false, error: 'Signups open in a few days. Check back soon!' });
}
