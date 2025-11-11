ALTER TABLE public.profiles
  ADD COLUMN failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN locked_until TIMESTAMPTZ;

CREATE INDEX idx_profiles_locked_until ON public.profiles(locked_until)
  WHERE locked_until IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_account_locked(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked_until_time TIMESTAMPTZ;
BEGIN
  SELECT locked_until INTO locked_until_time
  FROM public.profiles
  WHERE id = user_id;

  IF locked_until_time IS NULL OR locked_until_time <= NOW() THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_failed_login_attempts(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_attempt_count INTEGER;
  max_attempts INTEGER := 5;
  lockout_duration INTERVAL := '15 minutes';
BEGIN
  UPDATE public.profiles
  SET failed_login_attempts = failed_login_attempts + 1
  WHERE id = user_id
  RETURNING failed_login_attempts INTO new_attempt_count;

  IF new_attempt_count >= max_attempts THEN
    UPDATE public.profiles
    SET locked_until = NOW() + lockout_duration
    WHERE id = user_id;
  END IF;

  RETURN new_attempt_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_failed_login_attempts(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    failed_login_attempts = 0,
    locked_until = NULL
  WHERE id = user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_remaining_login_attempts(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_attempts INTEGER;
  max_attempts INTEGER := 5;
BEGIN
  SELECT failed_login_attempts INTO failed_attempts
  FROM public.profiles
  WHERE id = user_id;

  RETURN GREATEST(0, max_attempts - COALESCE(failed_attempts, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE LOWER(email) = LOWER(user_email);

  RETURN user_uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_login_info(user_id UUID)
RETURNS TABLE (
  id UUID,
  failed_login_attempts INTEGER,
  locked_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.failed_login_attempts, p.locked_until
  FROM public.profiles p
  WHERE p.id = user_id;
END;
$$;
