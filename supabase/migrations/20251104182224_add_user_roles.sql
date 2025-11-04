CREATE TYPE user_role AS ENUM ('building_owner', 'apartment_owner', 'resident');

ALTER TABLE public.profiles ADD COLUMN role user_role NOT NULL DEFAULT 'resident';

-- Make apartment_number optional (building owners might not have one)
ALTER TABLE public.profiles ALTER COLUMN apartment_number DROP NOT NULL;

CREATE INDEX idx_profiles_role ON public.profiles(role);
