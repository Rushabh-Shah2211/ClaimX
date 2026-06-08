// /api/r2upload — Cloudflare R2 storage via presigned URLs (AWS Sig V4)
// Browser uploads DIRECTLY to R2 — Vercel never touches the file bytes.

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://xpensr.in').split(',').map(s => s.trim());

function setCORS(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-company-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

function cfg() {
  return {
    accountId : process.env.R2_ACCOUNT_ID        || '',
    accessKey : process.env.R2_ACCESS_KEY_ID     || '',
    secretKey : process.env.R2_SECRET_ACCESS_KEY || '',
    bucket    : process.env.R2_BUCKET_NAME       || '',
    pubUrl    : process.env.VITE_R2_PUBLIC_URL   || '',
  };
}

async function presign(method, key) {
  const { accountId, accessKey, secretKey, bucket } = cfg();
  if (!accountId || !accessKey || !secretKey || !bucket) {
    throw new Error(`Missing R2 env vars. Have: accountId=${!!accountId} accessKey=${!!accessKey} secretKey=${!!secretKey} bucket=${!!bucket}`);
  }

  // Correct R2 endpoint format: https://<accountId>.r2.cloudflarestorage.com
  // Object path:  /<bucket>/<key>
  const host      = `${accountId}.r2.cloudflarestorage.com`;
  const objectPath= `/${bucket}/${key}`;
  const region    = 'auto';
  const service   = 's3';

  const now        = new Date();
  const dateStr    = now.toISOString().slice(0,10).replace(/-/g,'');         // YYYYMMDD
  const datetimeStr= now.toISOString().replace(/[-:]/g,'').replace(/\.\d+/,''); // YYYYMMDDTHHmmssZ

  const credScope  = `${dateStr}/${region}/${service}/aws4_request`;
  const credential = `${accessKey}/${credScope}`;

  // Query string params for presigned URL (alphabetical order required)
  const qp = new URLSearchParams([
    ['X-Amz-Algorithm',     'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential',    credential],
    ['X-Amz-Date',          datetimeStr],
    ['X-Amz-Expires',       '3600'],
    ['X-Amz-SignedHeaders', 'host'],
  ]);
  const queryString = qp.toString();

  const enc  = new TextEncoder();
  const sig  = async (k, m) => {
    const ck = await crypto.subtle.importKey('raw', k, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', ck, enc.encode(m)));
  };
  const hex  = b => Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
  const sha  = async s => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));

  const canonical = [
    method,
    objectPath,
    queryString,
    `host:${host}\n`,   // canonical headers (must end with \n)
    'host',              // signed headers
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetimeStr,
    credScope,
    await sha(canonical),
  ].join('\n');

  const kDate    = await sig(enc.encode(`AWS4${secretKey}`), dateStr);
  const kRegion  = await sig(kDate, region);
  const kService = await sig(kRegion, service);
  const kSigning = await sig(kService, 'aws4_request');
  const signature = hex(await sig(kSigning, stringToSign));

  return `https://${host}${objectPath}?${queryString}&X-Amz-Signature=${signature}`;
}

export default async function handler(req, res) {
  setCORS(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action, key } = req.query || {};

    if (action === 'view' && key) {
      try {
        const viewUrl = await presign('GET', decodeURIComponent(key));
        return res.status(200).json({ viewUrl });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // Diagnostic
    const { accountId, accessKey, secretKey, bucket, pubUrl } = cfg();
    const missing = [];
    if (!accountId) missing.push('R2_ACCOUNT_ID');
    if (!accessKey) missing.push('R2_ACCESS_KEY_ID');
    if (!secretKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (!bucket)    missing.push('R2_BUCKET_NAME');
    return res.status(200).json({
      configured : missing.length === 0,
      missing,
      bucket     : bucket || null,
      publicUrl  : pubUrl  || null,
      endpoint   : accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null,
      hint       : missing.length > 0
        ? `Add to Vercel env vars: ${missing.join(', ')}`
        : 'R2 configured. CORS must also be set on the bucket — see instructions.',
    });
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cid = req.headers['x-company-id'] || '';
  if (!cid) return res.status(400).json({ error: 'Missing x-company-id header.' });

  const { action, key, mimeType } = req.body || {};

  if (action === 'presign') {
    if (!key || !mimeType) return res.status(400).json({ error: 'key and mimeType required.' });
    const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
    if (!allowed.includes(mimeType)) return res.status(400).json({ error: 'File type not allowed.' });
    try {
      const putUrl = await presign('PUT', key);
      return res.status(200).json({ putUrl, key });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action. Use action=presign.' });
}
