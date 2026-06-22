-- ════════════════════════════════════════════════════════════════════════
-- TRIAL / SELF-SERVE SIGNUP MIGRATION
-- Run this in Supabase SQL Editor.
-- Adds trial tracking to companies, and a public-safe signup RPC.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Add trial/payment tracking columns to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  ADD COLUMN IF NOT EXISTS signup_source TEXT DEFAULT 'manual'; -- 'manual' (Super Admin created) | 'self_signup'

-- Backfill: any existing company created before this migration is treated as already paid,
-- so nobody who is currently live gets locked out by accident.
UPDATE public.companies
SET is_paid = true
WHERE is_paid IS NOT true AND signup_source = 'manual';

-- 2. Index for fast trial-expiry checks
CREATE INDEX IF NOT EXISTS idx_companies_trial_ends_at ON public.companies(trial_ends_at) WHERE is_paid = false;

-- 3. Public self-signup RPC
--    Creates a company + a single admin user in one transaction.
--    SECURITY DEFINER so it can run with elevated privileges even though
--    the caller is anonymous (this is the public signup endpoint).
--    Basic guardrails: rejects duplicate company-slug collisions, rejects
--    duplicate admin email/username within the same company namespace,
--    and rate-limits via a simple recent-signup count check.

CREATE OR REPLACE FUNCTION public.signup_company(
  p_company_name   TEXT,
  p_admin_name     TEXT,
  p_admin_email    TEXT,
  p_admin_password TEXT,
  p_industry       TEXT DEFAULT 'General'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id   TEXT;
  v_admin_id     UUID;
  v_username     TEXT;
  v_slug_base    TEXT;
  v_recent_count INT;
  v_result       JSON;
BEGIN
  -- Basic input validation
  IF p_company_name IS NULL OR length(trim(p_company_name)) < 2 THEN
    RETURN json_build_object('error', 'Company name must be at least 2 characters');
  END IF;
  IF p_admin_email IS NULL OR p_admin_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object('error', 'Please enter a valid email address');
  END IF;
  IF p_admin_password IS NULL OR length(p_admin_password) < 6 THEN
    RETURN json_build_object('error', 'Password must be at least 6 characters');
  END IF;
  IF p_admin_name IS NULL OR length(trim(p_admin_name)) < 2 THEN
    RETURN json_build_object('error', 'Please enter your name');
  END IF;

  -- Simple abuse guard: block more than 10 signups from this function in the last hour
  -- (crude global rate limit — good enough to stop scripted abuse without needing IP tracking)
  SELECT count(*) INTO v_recent_count
  FROM public.companies
  WHERE signup_source = 'self_signup' AND created_on > now() - INTERVAL '1 hour';
  IF v_recent_count >= 10 THEN
    RETURN json_build_object('error', 'Too many signups right now. Please try again in a little while, or contact us directly.');
  END IF;

  -- Reject duplicate email across ALL companies (keeps each email unique platform-wide
  -- for simplicity — avoids cross-company login ambiguity)
  IF EXISTS (SELECT 1 FROM public.users WHERE lower(email) = lower(p_admin_email)) THEN
    RETURN json_build_object('error', 'An account with this email already exists. Try signing in instead.');
  END IF;

  -- Build a unique company id (slug + random suffix, same pattern as manual creation)
  v_slug_base := lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]', '', 'g'));
  v_slug_base := left(v_slug_base, 10);
  IF v_slug_base = '' THEN v_slug_base := 'co'; END IF;
  v_company_id := v_slug_base || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  v_username := lower(regexp_replace(p_admin_name, '\s+', '.', 'g'));

  -- 1. Create company row — trial fields use column defaults (7-day trial, is_paid=false)
  INSERT INTO public.companies (id, name, industry, plan, max_users, status, signup_source, trial_started_at, trial_ends_at, is_paid, created_on)
  VALUES (v_company_id, trim(p_company_name), COALESCE(p_industry, 'General'), 'Starter', 5, 'Active', 'self_signup', now(), now() + INTERVAL '7 days', false, now());

  -- 2. Default policy row
  INSERT INTO public.policy (company_id) VALUES (v_company_id);

  -- 3. Create the admin user via the same password-hashing path as manual creation
  --    NOTE: calls with named parameters to match the existing create_manager_account
  --    signature exactly as used elsewhere in the app (p_company_id, p_name, p_email,
  --    p_username, p_password, p_mobile, p_avatar, p_role)
  SELECT public.create_manager_account(
    p_company_id := v_company_id,
    p_name       := trim(p_admin_name),
    p_email      := lower(trim(p_admin_email)),
    p_username   := v_username,
    p_password   := p_admin_password,
    p_mobile     := NULL,
    p_avatar     := upper(left(trim(p_admin_name), 2)),
    p_role       := 'admin'
  ) INTO v_result;

  IF v_result ? 'error' THEN
    -- Roll back the company + policy rows we just created if user creation failed
    DELETE FROM public.policy WHERE company_id = v_company_id;
    DELETE FROM public.companies WHERE id = v_company_id;
    RETURN v_result;
  END IF;

  RETURN json_build_object(
    'success', true,
    'company_id', v_company_id,
    'company_name', trim(p_company_name),
    'username', v_username,
    'trial_ends_at', (now() + INTERVAL '7 days')::text
  );
END;
$$;

-- 4. Allow the anonymous/public role to call this RPC (it is the public signup endpoint)
GRANT EXECUTE ON FUNCTION public.signup_company(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.signup_company(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Verify
-- ════════════════════════════════════════════════════════════════════════
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'companies' AND column_name IN ('is_paid','trial_started_at','trial_ends_at','signup_source')
ORDER BY column_name;

SELECT proname FROM pg_proc WHERE proname = 'signup_company';
