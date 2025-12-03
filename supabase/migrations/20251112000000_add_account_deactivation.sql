-- Add account deactivation support to profiles table
ALTER TABLE public.profiles
  ADD COLUMN deactivated_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN deactivation_reason TEXT DEFAULT NULL;

CREATE INDEX idx_profiles_deactivated_at ON public.profiles(deactivated_at)
  WHERE deactivated_at IS NOT NULL;

-- Function to deactivate a user account
-- Only building_manager can deactivate other users' accounts
-- Users can deactivate their own accounts
CREATE OR REPLACE FUNCTION public.deactivate_account(
  target_user_id UUID,
  reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id UUID;
  caller_role public.user_role;
BEGIN
  caller_id := auth.uid();

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_id != target_user_id AND caller_role != 'building_manager' THEN
    RAISE EXCEPTION 'Only building owners can deactivate other users accounts';
  END IF;

  UPDATE public.profiles
  SET
    deactivated_at = NOW(),
    deactivation_reason = reason
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Function to reactivate a user account
-- Only building_manager can reactivate accounts
CREATE OR REPLACE FUNCTION public.reactivate_account(
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id UUID;
  caller_role public.user_role;
BEGIN
  caller_id := auth.uid();

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role != 'building_manager' THEN
    RAISE EXCEPTION 'Only building owners can reactivate accounts';
  END IF;

  UPDATE public.profiles
  SET
    deactivated_at = NULL,
    deactivation_reason = NULL
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Function to check if account is deactivated
CREATE OR REPLACE FUNCTION public.is_account_deactivated(
  check_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deactivation_date TIMESTAMPTZ;
BEGIN
  SELECT deactivated_at INTO deactivation_date
  FROM public.profiles
  WHERE id = check_user_id;

  RETURN deactivation_date IS NOT NULL;
END;
$$;

-- Function to get account deactivation info
CREATE OR REPLACE FUNCTION public.get_account_deactivation_info(
  check_user_id UUID
)
RETURNS TABLE (
  is_deactivated BOOLEAN,
  deactivated_at TIMESTAMPTZ,
  deactivation_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (p.deactivated_at IS NOT NULL) as is_deactivated,
    p.deactivated_at,
    p.deactivation_reason
  FROM public.profiles p
  WHERE p.id = check_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.deactivate_account(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_deactivated(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_deactivation_info(UUID) TO authenticated;
