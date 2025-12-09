CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE LOG 'Creating profile for user % with metadata: %', NEW.id, NEW.raw_user_meta_data;

  INSERT INTO public.profiles (
    id,
    role,
    first_name,
    last_name,
    phone_number,
    email
  )
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'resident'::public.user_role),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    NEW.email
  );

  RAISE LOG 'Profile created successfully for user %', NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
