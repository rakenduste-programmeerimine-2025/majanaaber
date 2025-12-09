-- Fix buildings RLS policy to restrict resident access
-- Previous policy "Anyone can view buildings" was too permissive
-- New policy: Only managers can view their buildings directly
-- Residents should access buildings via building_residents table instead

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view buildings" ON public.buildings;

-- Create restricted policy: Only managers can view buildings
-- Residents will access buildings through the building_residents table which has its own policies
CREATE POLICY "Managers can view their buildings"
  ON public.buildings
  FOR SELECT
  USING (
    manager_id = auth.uid()
  );
