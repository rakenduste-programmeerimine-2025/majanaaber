-- Allow building managers (building_manager role) to search and view all profiles
-- and manage residents in their buildings
-- This enables managers to find, add, and remove residents

-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (check existence first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can read their own profile') THEN
    DROP POLICY "Users can read their own profile" ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Building owners can read all profiles') THEN
    DROP POLICY "Building owners can read all profiles" ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Authenticated users can read profiles') THEN
    DROP POLICY "Authenticated users can read profiles" ON public.profiles;
  END IF;
END
$$;

-- Policy 1: Users can read their own profile
CREATE POLICY "Users can read their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Building managers can read all profiles to find residents
-- Only allow users who manage at least one building
CREATE POLICY "Building managers can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.buildings WHERE manager_id = auth.uid()
    )
  );

-- Enable RLS on building_residents if not already enabled
ALTER TABLE public.building_residents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (check existence first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'building_residents' AND policyname = 'Users can read their own resident records') THEN
    DROP POLICY "Users can read their own resident records" ON public.building_residents;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'building_residents' AND policyname = 'Building managers can manage residents') THEN
    DROP POLICY "Building managers can manage residents" ON public.building_residents;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'building_residents' AND policyname = 'Building managers can insert residents') THEN
    DROP POLICY "Building managers can insert residents" ON public.building_residents;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'building_residents' AND policyname = 'Building managers can delete residents') THEN
    DROP POLICY "Building managers can delete residents" ON public.building_residents;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'building_residents' AND policyname = 'Building managers can update residents') THEN
    DROP POLICY "Building managers can update residents" ON public.building_residents;
  END IF;
END
$$;

-- Create policy for users to read their own resident records
CREATE POLICY "Users can read their own resident records"
  ON public.building_residents
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
  );

-- Create policy for building managers to insert residents
CREATE POLICY "Building managers can insert residents"
  ON public.building_residents
  FOR INSERT
  WITH CHECK (
    (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
  );

-- Create policy for building managers to delete residents
CREATE POLICY "Building managers can delete residents"
  ON public.building_residents
  FOR DELETE
  USING (
    (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
  );

-- Create policy for building managers to update residents
CREATE POLICY "Building managers can update residents"
  ON public.building_residents
  FOR UPDATE
  USING (
    (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
  )
  WITH CHECK (
    (SELECT manager_id FROM public.buildings WHERE id = building_residents.building_id) = auth.uid()
  );
