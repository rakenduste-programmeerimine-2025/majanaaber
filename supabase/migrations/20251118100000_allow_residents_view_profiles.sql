-- Allow users to view profiles of other residents in their buildings
-- This is needed so chat messages can display sender names

CREATE POLICY "Users can view profiles of residents in their buildings"
  ON public.profiles
  FOR SELECT
  USING (
    -- Users can always see their own profile (existing policy)
    auth.uid() = id
    OR
    -- Users can see profiles of people in buildings they manage
    EXISTS (
      SELECT 1 FROM public.buildings b
      JOIN public.building_residents br ON br.building_id = b.id
      WHERE b.manager_id = auth.uid()
      AND br.profile_id = profiles.id
    )
    OR
    -- Users can see profiles of other residents in buildings they belong to
    EXISTS (
      SELECT 1 FROM public.building_residents br1
      JOIN public.building_residents br2 ON br1.building_id = br2.building_id
      WHERE br1.profile_id = auth.uid()
      AND br1.is_approved = true
      AND br2.profile_id = profiles.id
      AND br2.is_approved = true
    )
    OR
    -- Users can see profiles of managers of buildings they belong to
    EXISTS (
      SELECT 1 FROM public.building_residents br
      JOIN public.buildings b ON b.id = br.building_id
      WHERE br.profile_id = auth.uid()
      AND br.is_approved = true
      AND b.manager_id = profiles.id
    )
  );
