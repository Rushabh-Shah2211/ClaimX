// /api/r2upload — Upload receipts directly to Cloudflare R2
// Credentials come from Vercel environment variables — never stored in DB.
// The browser sends base64 file data → this function streams it to R2.

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://xpensr.in').split(',').map(s => s.trim());

function setCORS(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-company-id');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

// Generate presigned R2 upload URL using AWS Signature V4
// Cloudflare R2 is fully S3-compatible
async function signedPutUrl(key, mimeType) {
  const accountId  = process.env.R2_ACCOUNT_ID      || '';
  const accessKey  = process.env.R2_ACCESS_KEY_ID   || '';
  const secretKey  = process.env.R2_SECRET_ACCESS_KEY || '';
  const bucket     = process.env.R2_BUCKET_NAME      || '';
  const customDomain = process.env.R2_PUBLIC_URL     || ''; // optional custom domain

  if (!accountId || !accessKey || !secretKey || !bucket) {
    throw new Error('R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME in Vercel env vars.');
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const region   = 'auto';
  const service  = 's3';

  const now       = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const expiresIn = 3600;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKey}/${credentialScope}`;
  const host = `${bucket}.${accountId}.r2.cloudflarestorage.com`;
  const objectUrl = `${endpoint}/${bucket}/${key}`;

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
    'X-Amz-Credential':    credential,
    'X-Amz-Date':          amzDate,
    'X-Amz-Expires':       String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  });

  const encoder = new TextEncoder();
  const sign = async (keyData, msg) => {
    const k = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(msg)));
  };
  const toHex = buf => Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');

  const canonicalRequest = [
    'PUT',
    `/${bucket}/${key}`,
    queryParams.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const hashedRequest = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))));
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashedRequest].join('\n');

  const kDate    = await sign(encoder.encode(`AWS4${secretKey}`), dateStamp);
  const kRegion  = await sign(kDate, region);
  const kService = await sign(kRegion, service);
  const kSigning = await sign(kService, 'aws4_request');
  const signature = toHex(await sign(kSigning, stringToSign));

  const uploadUrl = `${objectUrl}?${queryParams}&X-Amz-Signature=${signature}`;

  // Public URL for viewing the file later
  const publicUrl = customDomain
    ? `${customDomain.replace(/\/$/, '')}/${key}`
    : `${objectUrl}`;

  return { uploadUrl, publicUrl, objectUrl };
}

export default async function handler(req, res) {
  setCORS(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 15_000_000) return res.status(413).json({ error: 'File too large (max 10MB).' });

  const companyId = req.headers['x-company-id'] || '';
  if (!companyId) return res.status(400).json({ error: 'Missing company ID.' });

  const { key, mimeType, dataBase64 } = req.body || {};
  if (!key || !mimeType || !dataBase64)
    return res.status(400).json({ error: 'key, mimeType and dataBase64 are required.' });

  // Validate mime type — only images and PDFs
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(mimeType))
    return res.status(400).json({ error: 'File type not allowed.' });

  try {
    const { uploadUrl } = await signedPutUrl(key, mimeType);

    // Convert base64 to binary and upload directly to R2
    const binary = atob(dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const r2Response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: bytes,
    });

    if (!r2Response.ok) {
      const errText = await r2Response.text().catch(() => r2Response.status);
      return res.status(500).json({ error: `R2 upload failed: ${errText}` });
    }

    return res.status(200).json({
      success: true,
      storagePath: key,
      provider: 'r2',
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
