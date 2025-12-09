-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster email searches
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Create function to keep email in sync when it changes in auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync email updates (only drop if exists)
DO $$
BEGIN
  DROP TRIGGER IF EXISTS sync_email_to_profile ON auth.users;
EXCEPTION
  WHEN undefined_object THEN NULL;
END
$$;

CREATE TRIGGER sync_email_to_profile
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email();
