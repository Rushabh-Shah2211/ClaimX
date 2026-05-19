// Vercel Serverless Function — Email via Resend
// POST /api/email  { to, subject, html }
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const key = process.env.RESEND_API_KEY;
  if (!key) { res.status(500).json({ error: 'RESEND_API_KEY not set in Vercel env vars' }); return; }

  const { to, subject, html, from } = req.body;
  if (!to || !subject || !html) { res.status(400).json({ error: 'Missing to/subject/html' }); return; }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        from: from || 'ClaimX by RB <noreply@claimx.in>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
