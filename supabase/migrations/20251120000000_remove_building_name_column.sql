-- Remove the name column from buildings table as we now use full_address everywhere
ALTER TABLE public.buildings DROP COLUMN IF EXISTS name;
