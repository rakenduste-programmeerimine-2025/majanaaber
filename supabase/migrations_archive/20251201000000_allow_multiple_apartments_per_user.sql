-- Allow a user to have multiple apartments in the same building
-- Change from UNIQUE(building_id, profile_id) to UNIQUE(building_id, profile_id, apartment_number)
-- This prevents duplicate entries for the same user in the same apartment while allowing multiple apartments

-- Drop the old constraint
ALTER TABLE public.building_residents DROP CONSTRAINT IF EXISTS building_residents_building_id_profile_id_key;

-- Add new constraint that prevents duplicates only for the same apartment
ALTER TABLE public.building_residents ADD CONSTRAINT building_residents_unique_user_apartment 
  UNIQUE(building_id, profile_id, apartment_number);
