// Vercel Serverless Function — Anthropic AI proxy with per-company token metering
// Every call: 1) checks company token balance, 2) calls Claude, 3) deducts actual tokens used
// Companies must have purchased an AI token pack — no tokens = 403

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://xpensr.in').split(',').map(s => s.trim());

function setCORS(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, anthropic-version, x-company-id');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

// Simple rate limit: 60 requests/company/minute
const companyRequests = new Map();
function checkRateLimit(companyId) {
  const now = Date.now();
  const entry = companyRequests.get(companyId) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60000; }
  entry.count++;
  companyRequests.set(companyId, entry);
  return entry.count <= 60;
}

// Approximate token count for a text string (rough: 4 chars ≈ 1 token)
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

export default async function handler(req, res) {
  setCORS(req, res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  // Reject oversized payloads (max 1MB for API calls)
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 1_000_000) {
    return res.status(413).json({ error: 'Request too large.' });
  }

  // Every request must carry the company ID in the header
  const companyId = req.headers['x-company-id'] || '';
  if (!companyId) {
    return res.status(400).json({ error: { message: 'Missing company ID.' } });
  }

  // Rate limit per company
  if (!checkRateLimit(companyId)) {
    return res.status(429).json({ error: { message: 'Too many AI requests. Please wait a minute.' } });
  }

  const anthropicKey = process.env.ANTHROPIC_KEY || '';
  if (!anthropicKey) {
    return res.status(500).json({ error: { message: 'AI service not configured on server.' } });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !supabaseService) {
    return res.status(500).json({ error: { message: 'Database service not configured.' } });
  }

  // Connect with service role to read/write ai_tokens — bypasses RLS safely (server-side only)
  const db = createClient(supabaseUrl, supabaseService, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // ── Step 1: Check token balance ──────────────────────────────────────────────
  const { data: tokenRow, error: tokenErr } = await db
    .from('ai_tokens')
    .select('balance, used_total, is_active, plan_label')
    .eq('company_id', companyId)
    .single();

  if (tokenErr || !tokenRow) {
    return res.status(403).json({
      error: { message: 'AI features not activated for your company. Purchase a token pack from your Admin panel.' },
      code: 'NO_AI_SUBSCRIPTION'
    });
  }

  if (!tokenRow.is_active) {
    return res.status(403).json({
      error: { message: 'Your AI subscription is paused. Contact your Admin.' },
      code: 'AI_PAUSED'
    });
  }

  if (tokenRow.balance <= 0) {
    return res.status(402).json({
      error: { message: `AI tokens exhausted (${tokenRow.plan_label || 'pack'} used up). Purchase more tokens from Settings → AI Subscription.` },
      code: 'TOKENS_EXHAUSTED',
      balance: 0
    });
  }

  // ── Step 2: Validate and sanitize request body ───────────────────────────────
  const { model, messages, system, max_tokens } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Invalid request.' } });
  }
  if (messages.length > 20) {
    return res.status(400).json({ error: { message: 'Message context too large.' } });
  }

  // Estimate input tokens to check if we have enough before even calling the API
  const inputTokenEstimate = estimateTokens(system || '') +
    messages.reduce((s, m) => s + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0);
  const outputTokenCap = Math.min(max_tokens || 1000, 1500);

  if (tokenRow.balance < inputTokenEstimate) {
    return res.status(402).json({
      error: { message: `Insufficient tokens (need ~${inputTokenEstimate}, have ${tokenRow.balance}). Purchase more from Settings → AI Subscription.` },
      code: 'TOKENS_EXHAUSTED',
      balance: tokenRow.balance
    });
  }

  // ── Step 3: Call Anthropic ───────────────────────────────────────────────────
  let anthropicData;
  let responseStatus;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001', // Default to Haiku (cheapest) for cost efficiency
        messages,
        system,
        max_tokens: outputTokenCap,
      }),
    });
    responseStatus = response.status;
    anthropicData = await response.json();
  } catch (err) {
    return res.status(500).json({ error: { message: 'AI service temporarily unavailable.' } });
  }

  // ── Step 4: Deduct actual tokens used ────────────────────────────────────────
  if (responseStatus === 200 && anthropicData?.usage) {
    const tokensUsed = (anthropicData.usage.input_tokens || 0) + (anthropicData.usage.output_tokens || 0);
    if (tokensUsed > 0) {
      // Atomic decrement — prevents race conditions
      await db.rpc('deduct_ai_tokens', {
        p_company_id: companyId,
        p_tokens: tokensUsed,
      });

      // Log every call for billing transparency
      await db.from('ai_usage_log').insert({
        company_id: companyId,
        tokens_used: tokensUsed,
        input_tokens: anthropicData.usage.input_tokens || 0,
        output_tokens: anthropicData.usage.output_tokens || 0,
        model: model || 'claude-haiku-4-5-20251001',
        feature: req.body._feature || 'unknown', // passed from frontend: 'ocr' or 'chat'
        created_at: new Date().toISOString(),
      });
    }

    // Attach remaining balance to response so frontend can update its display
    anthropicData._tokenBalance = Math.max(0, tokenRow.balance - tokensUsed);
    anthropicData._tokensUsed = tokensUsed;
  }

  return res.status(responseStatus).json(anthropicData);
}
