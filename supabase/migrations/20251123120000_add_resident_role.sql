-- Add resident role to building_residents table
-- Allows distinguishing between residents and apartment owners

ALTER TABLE public.building_residents ADD COLUMN resident_role TEXT DEFAULT 'resident';

-- Add check constraint for valid roles
ALTER TABLE public.building_residents ADD CONSTRAINT valid_resident_role 
  CHECK (resident_role IN ('resident', 'apartment_owner'));

-- Create index for filtering by role
CREATE INDEX idx_building_residents_role ON public.building_residents(resident_role);
