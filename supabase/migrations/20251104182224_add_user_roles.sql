CREATE TYPE user_role AS ENUM ('building_manager', 'apartment_owner', 'resident');

ALTER TABLE public.profiles ADD COLUMN role user_role NOT NULL DEFAULT 'resident';

-- Make apartment_number optional (building owners might not have one)
ALTER TABLE public.profiles ALTER COLUMN apartment_number DROP NOT NULL;

CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Create SECURITY DEFINER function to check if user is a building manager
-- This avoids infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.user_is_building_manager(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role = 'building_manager'::public.user_role
  FROM public.profiles
  WHERE id = check_user_id;
$$;

-- Allow managers to update user roles (for building handover)
CREATE POLICY "Managers can update user roles"
  ON public.profiles
  FOR UPDATE
  USING (
    true
  )
  WITH CHECK (
    public.user_is_building_manager(auth.uid())
  );
