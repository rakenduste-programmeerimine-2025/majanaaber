-- Fix security vulnerability in get_or_create_conversation function
-- The function was SECURITY DEFINER but did not validate that the caller
-- is one of the participants, allowing any authenticated user to create
-- conversations between arbitrary users.

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  user1_id UUID,
  user2_id UUID
) RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  p1_id UUID;
  p2_id UUID;
  caller_id UUID;
BEGIN
  -- Get the caller's user ID
  caller_id := auth.uid();

  -- Security check: caller must be authenticated and be one of the participants
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF caller_id != user1_id AND caller_id != user2_id THEN
    RAISE EXCEPTION 'Not authorized: you can only create conversations you are a participant in';
  END IF;

  -- Ensure participant1_id is always less than participant2_id
  IF user1_id < user2_id THEN
    p1_id := user1_id;
    p2_id := user2_id;
  ELSE
    p1_id := user2_id;
    p2_id := user1_id;
  END IF;

  -- Try to find existing conversation
  SELECT id INTO conv_id
  FROM public.conversations
  WHERE participant1_id = p1_id AND participant2_id = p2_id;

  -- If not found, create new conversation
  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (participant1_id, participant2_id)
    VALUES (p1_id, p2_id)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment documenting why SECURITY DEFINER is needed
COMMENT ON FUNCTION public.get_or_create_conversation(UUID, UUID) IS
'Gets or creates a conversation between two users. Uses SECURITY DEFINER to bypass RLS
for the INSERT operation while maintaining security through explicit auth.uid() checks.
The caller must be authenticated and must be one of the two participants.';
