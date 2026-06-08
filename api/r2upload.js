// /api/r2upload — Cloudflare R2 storage
// Flow: browser asks server for presigned PUT URL → browser uploads directly to R2
// This bypasses Vercel's 4.5MB body size limit entirely.

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://xpensr.in').split(',').map(s => s.trim());

function setCORS(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-company-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

function getR2Config() {
  const accountId  = process.env.R2_ACCOUNT_ID        || '';
  const accessKey  = process.env.R2_ACCESS_KEY_ID     || '';
  const secretKey  = process.env.R2_SECRET_ACCESS_KEY || '';
  const bucket     = process.env.R2_BUCKET_NAME       || '';
  const pubUrl     = process.env.VITE_R2_PUBLIC_URL   || '';
  return { accountId, accessKey, secretKey, bucket, pubUrl };
}

async function makePresignedUrl(key, mimeType, method = 'PUT') {
  const { accountId, accessKey, secretKey, bucket } = getR2Config();

  if (!accountId || !accessKey || !secretKey || !bucket) {
    throw new Error('R2 environment variables not set. Check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME in Vercel.');
  }

  const host     = `${accountId}.r2.cloudflarestorage.com`;
  const region   = 'auto';
  const service  = 's3';
  const now      = new Date();
  const dateStamp= now.toISOString().slice(0,10).replace(/-/g,'');
  const amzDate  = now.toISOString().replace(/[:\-]|\.\d{3}/g,'').slice(0,15)+'Z';
  const expiry   = 3600;

  const credScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential= `${accessKey}/${credScope}`;

  const qp = new URLSearchParams({
    'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
    'X-Amz-Credential':    credential,
    'X-Amz-Date':          amzDate,
    'X-Amz-Expires':       String(expiry),
    'X-Amz-SignedHeaders': 'host',
  });

  const enc = new TextEncoder();

  const sign = async (k, msg) => {
    const ck = await crypto.subtle.importKey('raw', k, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', ck, enc.encode(msg)));
  };
  const hex = b => Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');

  const canonical = [
    method,
    `/${key}`,
    qp.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const hashed = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(canonical))));
  const sts    = ['AWS4-HMAC-SHA256', amzDate, credScope, hashed].join('\n');

  const kDate = await sign(enc.encode(`AWS4${secretKey}`), dateStamp);
  const kReg  = await sign(kDate, region);
  const kSvc  = await sign(kReg, service);
  const kSign = await sign(kSvc, 'aws4_request');
  const sig   = hex(await sign(kSign, sts));

  const url = `https://${host}/${bucket}/${key}?${qp}&X-Amz-Signature=${sig}`;
  return url;
}

export default async function handler(req, res) {
  setCORS(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── GET: diagnostic or signed view URL ──────────────────────────────────────
  if (req.method === 'GET') {
    const { action, key } = req.query || {};

    if (action === 'view' && key) {
      try {
        const viewUrl = await makePresignedUrl(decodeURIComponent(key), '', 'GET');
        return res.status(200).json({ viewUrl });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // Diagnostic
    const { accountId, accessKey, secretKey, bucket, pubUrl } = getR2Config();
    const missing = [];
    if (!accountId) missing.push('R2_ACCOUNT_ID');
    if (!accessKey) missing.push('R2_ACCESS_KEY_ID');
    if (!secretKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (!bucket)    missing.push('R2_BUCKET_NAME');
    return res.status(200).json({
      configured: missing.length === 0,
      missing,
      bucket: bucket || null,
      publicUrl: pubUrl || null,
      hint: missing.length > 0
        ? `Add to Vercel env vars: ${missing.join(', ')}`
        : 'R2 configured. Test by uploading a receipt.',
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const companyId = req.headers['x-company-id'] || '';
  if (!companyId) return res.status(400).json({ error: 'Missing x-company-id header.' });

  const { action, key, mimeType } = req.body || {};

  // ── POST action=presign: return presigned PUT URL ────────────────────────────
  // Browser then uploads the file directly to R2 — no size limit via Vercel
  if (action === 'presign') {
    if (!key || !mimeType) return res.status(400).json({ error: 'key and mimeType required.' });

    const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
    if (!allowed.includes(mimeType)) return res.status(400).json({ error: 'File type not allowed.' });

    try {
      const putUrl = await makePresignedUrl(key, mimeType, 'PUT');
      return res.status(200).json({ putUrl, key });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action. Use action=presign.' });
}
