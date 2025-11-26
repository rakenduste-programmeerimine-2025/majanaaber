-- Create a function to trigger email notifications for new notices
CREATE OR REPLACE FUNCTION trigger_notice_email()
RETURNS TRIGGER AS $$
DECLARE
  function_url text;
  service_role_key text;
BEGIN
  -- Get the edge function URL from environment
  -- In production, this should be set via environment variables
  function_url := current_setting('app.settings.edge_function_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If environment variables are not set, skip email sending (for local dev)
  IF function_url IS NULL OR function_url = '' THEN
    RAISE NOTICE 'Edge function URL not configured, skipping email notification';
    RETURN NEW;
  END IF;

  -- Call the edge function asynchronously using pg_net (if available)
  -- This prevents blocking the notice creation
  BEGIN
    PERFORM
      net.http_post(
        url := function_url || '/functions/v1/send-notice-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'notice_id', NEW.id,
          'building_id', NEW.building_id
        )
      );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the notice creation
      RAISE NOTICE 'Failed to trigger email notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_notice_created
  AFTER INSERT ON notices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notice_email();

-- Note: For this to work in production, you need to:
-- 1. Deploy the edge function: supabase functions deploy send-notice-email
-- 2. Set the RESEND_API_KEY secret: supabase secrets set RESEND_API_KEY=your_key
-- 3. Configure the edge function URL in your Supabase project settings
