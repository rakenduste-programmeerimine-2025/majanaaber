-- Fix RLS infinite recursion between buildings and building_residents
-- Multiple issues:
-- 1. buildings had policy querying building_residents
-- 2. building_residents had policy querying buildings
-- 3. building_residents had self-referential policy
--
-- Solution:
-- 1. Allow all authenticated users to SELECT buildings (addresses aren't sensitive)
-- 2. Replace self-referential building_residents policy with SECURITY DEFINER function

-- Drop the manager-only policy from 20251201010000
DROP POLICY IF EXISTS "Managers can view their buildings" ON public.buildings;

-- Restore a permissive SELECT policy for authenticated users
CREATE POLICY "Authenticated users can view buildings"
  ON public.buildings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create SECURITY DEFINER function to check if user is approved resident of a building
-- This bypasses RLS to avoid self-referential recursion
CREATE OR REPLACE FUNCTION public.user_is_approved_resident_of_building(check_building_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.building_residents
    WHERE building_id = check_building_id
    AND profile_id = check_user_id
    AND is_approved = true
  );
$$;

-- Drop the problematic self-referential policy
DROP POLICY IF EXISTS "Approved residents can view other residents in their building" ON public.building_residents;

-- Recreate using SECURITY DEFINER function
CREATE POLICY "Approved residents can view other residents in their building"
  ON public.building_residents
  FOR SELECT
  USING (
    -- User must be an approved resident of the same building
    public.user_is_approved_resident_of_building(building_id, auth.uid())
    -- And can only see other approved residents
    AND is_approved = true
  );
