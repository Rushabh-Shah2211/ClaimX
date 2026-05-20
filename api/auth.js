// /api/auth — ClaimX JWT Auth Bridge
// Validates custom credentials, then issues a real Supabase JWT
// so auth.uid() works in RLS policies on all subsequent DB calls

import { createClient } from '@supabase/supabase-js';

const SUPA_URL  = process.env.VITE_SUPABASE_URL;
const SUPA_ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side only — never in browser

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { login, password } = req.body || {};
  if (!login || !password) {
    return res.status(400).json({ error: 'Missing login or password' });
  }

  if (!SUPA_URL || !SUPA_ANON || !SUPA_SERVICE) {
    return res.status(500).json({ error: 'Server not configured (missing Supabase keys)' });
  }

  // Step 1: Validate credentials using the RPC (uses anon key — safe)
  const anonClient = createClient(SUPA_URL, SUPA_ANON);
  const { data: userData, error: rpcErr } = await anonClient.rpc('authenticate_user', {
    p_login: login,
    p_password: password,
  });

  if (rpcErr) {
    return res.status(401).json({ error: rpcErr.message });
  }
  if (!userData || userData.error) {
    return res.status(401).json({ error: userData?.error || 'Authentication failed' });
  }

  // Step 2: Use service role to create a real Supabase Auth session for this user
  // This gives us a JWT that auth.uid() recognises
  const serviceClient = createClient(SUPA_URL, SUPA_SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Check if this user already has a Supabase Auth account
  // We use their UUID as the Supabase Auth user ID (they must match)
  let supabaseJWT = null;
  let supabaseSession = null;

  try {
    // Try to get an admin link (magic link) for this user's auth account
    // We identify Supabase Auth users by email: claimx_{user_id}@claimx.internal
    const syntheticEmail = `claimx_${userData.id}@claimx.internal`;
    const syntheticPassword = `claimx_${userData.id}_${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-8) || 'secret'}`;

    // Try signing in first (user may already exist)
    let { data: signInData, error: signInErr } = await serviceClient.auth.signInWithPassword({
      email: syntheticEmail,
      password: syntheticPassword,
    });

    if (signInErr || !signInData?.session) {
      // User doesn't exist yet — create them
      const { data: newUser, error: createErr } = await serviceClient.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: { claimx_user_id: userData.id, company_id: userData.company_id },
        // Use the same UUID as the ClaimX users table
        // Note: Supabase doesn't allow setting UUID on createUser directly
        // We handle this via a mapping approach below
      });

      if (createErr) {
        console.error('Auth user create failed:', createErr.message);
        // Fallback: return userData without JWT (app uses custom session)
        return res.status(200).json({ ...userData, jwt_mode: false });
      }

      // Sign in with the newly created user
      const { data: retryData } = await serviceClient.auth.signInWithPassword({
        email: syntheticEmail,
        password: syntheticPassword,
      });
      signInData = retryData;
    }

    supabaseSession = signInData?.session;
    supabaseJWT = supabaseSession?.access_token;

    // Store the mapping: Supabase Auth UUID → ClaimX users table UUID
    // We need RLS to use the ClaimX UUID, not the Supabase Auth UUID
    if (supabaseSession?.user?.id && supabaseSession.user.id !== userData.id) {
      // Update auth_user_id in users table so RLS can map
      await serviceClient
        .from('users')
        .update({ auth_user_id: supabaseSession.user.id })
        .eq('id', userData.id);
    }

  } catch (e) {
    console.error('JWT creation failed:', e.message);
    // Fallback — return user data without JWT
    return res.status(200).json({ ...userData, jwt_mode: false });
  }

  return res.status(200).json({
    ...userData,
    jwt_mode: true,
    access_token: supabaseJWT,
    refresh_token: supabaseSession?.refresh_token,
    expires_at: supabaseSession?.expires_at,
  });
}
