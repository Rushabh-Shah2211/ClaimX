// Vercel Serverless Function — WhatsApp via Interakt
// POST /api/whatsapp  { phone, templateName, params }
// Interakt API docs: https://dev.interakt.ai/reference
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const key = process.env.INTERAKT_API_KEY;
  if (!key) { res.status(500).json({ error: 'INTERAKT_API_KEY not set in Vercel env vars' }); return; }

  const { phone, templateName, params = [], countryCode = '91' } = req.body;
  if (!phone || !templateName) { res.status(400).json({ error: 'Missing phone/templateName' }); return; }

  // Clean phone number
  const cleanPhone = phone.replace(/\D/g, '').replace(/^0+/, '');

  try {
    const r = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(key).toString('base64')}`,
      },
      body: JSON.stringify({
        countryCode,
        phoneNumber: cleanPhone,
        callbackData: 'claimx_notification',
        type: 'Template',
        template: {
          name: templateName,
          languageCode: 'en',
          bodyValues: params,
        },
      }),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
