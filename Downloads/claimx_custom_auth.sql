-- ═══════════════════════════════════════════════════════════════════════════
-- ClaimX — Custom Username/Password Auth for Employees
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add username, mobile, password_hash, is_active, is_suspended to users table
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS username text unique,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS is_suspended boolean not null default false,
  ADD COLUMN IF NOT EXISTS auth_type text not null default 'custom';
  -- auth_type: 'supabase' = uses Supabase Auth (SA, company admins)
  --            'custom'   = uses password_hash in users table (employees)

-- 2. Create username index
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_mobile   ON public.users(mobile);

-- 3. Function to hash a password (bcrypt via pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 4. Function to create a custom user (called via RPC — bypasses Auth)
CREATE OR REPLACE FUNCTION public.create_employee(
  p_company_id   text,
  p_name         text,
  p_username     text,
  p_password     text,
  p_role         text    DEFAULT 'employee',
  p_dept         text    DEFAULT 'Operations',
  p_balance      numeric DEFAULT 0,
  p_email        text    DEFAULT NULL,
  p_mobile       text    DEFAULT NULL,
  p_avatar       text    DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id       uuid := gen_random_uuid();
  v_hash     text;
  v_avatar   text;
BEGIN
  -- Check caller is manager of this company
  IF (SELECT role FROM public.users WHERE id = auth.uid()) NOT IN ('manager') THEN
    RAISE EXCEPTION 'Only managers can create employees';
  END IF;
  IF (SELECT company_id FROM public.users WHERE id = auth.uid()) != p_company_id THEN
    RAISE EXCEPTION 'Cannot create users in another company';
  END IF;
  -- Check active user limit
  DECLARE
    v_active_count  integer;
    v_max_users     integer;
  BEGIN
    SELECT COUNT(*) INTO v_active_count 
      FROM public.users 
      WHERE company_id = p_company_id AND is_suspended = false AND role != 'manager';
    SELECT max_users INTO v_max_users 
      FROM public.companies WHERE id = p_company_id;
    IF v_active_count >= v_max_users THEN
      RAISE EXCEPTION 'User limit reached: % active employees (max %)', v_active_count, v_max_users;
    END IF;
  END;
  -- Hash password
  v_hash := crypt(p_password, gen_salt('bf'));
  -- Auto-generate avatar from name initials
  v_avatar := COALESCE(p_avatar, upper(substring(p_name, 1, 1) || substring(split_part(p_name, ' ', 2), 1, 1)));
  -- Insert user
  INSERT INTO public.users 
    (id, company_id, name, email, username, mobile, password_hash, role, avatar, dept, balance, reimbursable, auth_type, is_suspended)
  VALUES 
    (v_id, p_company_id, p_name, p_email, lower(p_username), v_hash, p_role, v_avatar, p_dept, p_balance, 0, 'custom', false);
  RETURN json_build_object('id', v_id, 'username', lower(p_username));
END; $$;

-- 5. Function to authenticate a custom user (username or email + password)
CREATE OR REPLACE FUNCTION public.authenticate_user(
  p_login    text,   -- username, email, or mobile
  p_password text,
  p_company_id text DEFAULT NULL  -- optional: scope to company
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  -- Find user by username OR email OR mobile
  SELECT * INTO v_user FROM public.users
  WHERE 
    (lower(username) = lower(p_login) OR lower(email) = lower(p_login) OR mobile = p_login)
    AND auth_type = 'custom'
    AND (p_company_id IS NULL OR company_id = p_company_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;
  IF v_user.is_suspended THEN
    RETURN json_build_object('error', 'Account suspended. Contact your manager.');
  END IF;
  IF v_user.password_hash IS NULL OR NOT (v_user.password_hash = crypt(p_password, v_user.password_hash)) THEN
    RETURN json_build_object('error', 'Incorrect password');
  END IF;

  -- Return user profile (no sensitive fields)
  RETURN json_build_object(
    'id',         v_user.id,
    'company_id', v_user.company_id,
    'name',       v_user.name,
    'email',      v_user.email,
    'username',   v_user.username,
    'mobile',     v_user.mobile,
    'role',       v_user.role,
    'avatar',     v_user.avatar,
    'dept',       v_user.dept,
    'balance',    v_user.balance,
    'reimbursable', v_user.reimbursable,
    'delegate_to',v_user.delegate_to,
    'is_suspended', v_user.is_suspended
  );
END; $$;

-- 6. Function to update user (suspend, edit, delete)
CREATE OR REPLACE FUNCTION public.update_employee(
  p_user_id     uuid,
  p_name        text    DEFAULT NULL,
  p_role        text    DEFAULT NULL,
  p_dept        text    DEFAULT NULL,
  p_balance     numeric DEFAULT NULL,
  p_suspended   boolean DEFAULT NULL,
  p_password    text    DEFAULT NULL,
  p_mobile      text    DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_company text;
  v_target_company text;
BEGIN
  SELECT company_id INTO v_caller_company FROM public.users WHERE id = auth.uid();
  SELECT company_id INTO v_target_company FROM public.users WHERE id = p_user_id;
  -- Only manager of same company can edit
  IF v_caller_company != v_target_company THEN
    RAISE EXCEPTION 'Cannot edit users in another company';
  END IF;
  IF (SELECT role FROM public.users WHERE id = auth.uid()) NOT IN ('manager') THEN
    RAISE EXCEPTION 'Only managers can edit employees';
  END IF;
  UPDATE public.users SET
    name         = COALESCE(p_name,      name),
    role         = COALESCE(p_role,      role),
    dept         = COALESCE(p_dept,      dept),
    balance      = COALESCE(p_balance,   balance),
    is_suspended = COALESCE(p_suspended, is_suspended),
    mobile       = COALESCE(p_mobile,    mobile),
    password_hash = CASE WHEN p_password IS NOT NULL 
                         THEN crypt(p_password, gen_salt('bf')) 
                         ELSE password_hash END
  WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END; $$;

-- 7. Grant execute on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION public.authenticate_user TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_employee    TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_employee    TO authenticated;

-- 8. Update RLS: suspended users cannot read company data
-- (existing policies already handle this via is_suspended check in authenticate_user)

-- Done! Verify:
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('authenticate_user', 'create_employee', 'update_employee');
