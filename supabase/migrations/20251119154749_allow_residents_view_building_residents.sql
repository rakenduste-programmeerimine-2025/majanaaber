-- Allow approved residents to view other approved residents in the same building
-- This is needed for P2P messaging where residents need to see who else is in their building

CREATE POLICY "Approved residents can view other residents in their building"
  ON public.building_residents
  FOR SELECT
  USING (
    -- User must be an approved resident in at least one building
    EXISTS (
      SELECT 1 FROM public.building_residents br_user
      WHERE br_user.profile_id = auth.uid()
      AND br_user.is_approved = true
      AND br_user.building_id = building_residents.building_id
    )
    -- And can only see other approved residents
    AND building_residents.is_approved = true
  );
