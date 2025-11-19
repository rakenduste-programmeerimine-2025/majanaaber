-- Migration to sync auth.users with profiles table
-- This ensures all existing auth users have a profile entry

-- Insert missing profiles for existing auth users
-- (This is useful after database resets where auth.users persist but profiles are deleted)
INSERT INTO public.profiles (id, first_name, last_name, phone_number, role)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'first_name', 'User') as first_name,
  COALESCE(au.raw_user_meta_data->>'last_name', split_part(au.email, '@', 1)) as last_name,
  COALESCE(au.raw_user_meta_data->>'phone_number', '') as phone_number,
  COALESCE((au.raw_user_meta_data->>'role')::user_role, 'resident'::user_role) as role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
