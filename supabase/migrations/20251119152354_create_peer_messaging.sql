CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Always store user IDs in consistent order (lower UUID first) to prevent duplicates
  participant1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  participant2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure participants are different users
  CONSTRAINT different_participants CHECK (participant1_id != participant2_id),
  -- Ensure participant1_id is always less than participant2_id for consistency
  CONSTRAINT ordered_participants CHECK (participant1_id < participant2_id),
  -- Ensure unique conversations between two users
  CONSTRAINT unique_conversation UNIQUE (participant1_id, participant2_id)
);

CREATE INDEX idx_conversations_participant1 ON public.conversations(participant1_id);
CREATE INDEX idx_conversations_participant2 ON public.conversations(participant2_id);
CREATE INDEX idx_conversations_last_message ON public.conversations(last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON public.conversations
  FOR SELECT
  USING (
    auth.uid() = participant1_id
    OR auth.uid() = participant2_id
  );

-- Will be handled by function to ensure ordering
CREATE POLICY "Users can create conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (auth.uid() = participant1_id OR auth.uid() = participant2_id)
  );

CREATE TABLE IF NOT EXISTS public.peer_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  edited_at TIMESTAMPTZ,
  reply_to_message_id UUID REFERENCES public.peer_messages(id) ON DELETE SET NULL,

  -- Prevent empty messages and enforce max length
  CONSTRAINT non_empty_content CHECK (length(trim(content)) > 0),
  CONSTRAINT content_max_length CHECK (length(content) <= 1000),
  -- Ensure sender and receiver are different
  CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

CREATE INDEX idx_peer_messages_conversation ON public.peer_messages(conversation_id);
CREATE INDEX idx_peer_messages_sender ON public.peer_messages(sender_id);
CREATE INDEX idx_peer_messages_receiver ON public.peer_messages(receiver_id);
CREATE INDEX idx_peer_messages_created_at ON public.peer_messages(created_at DESC);
CREATE INDEX idx_peer_messages_reply_to ON public.peer_messages(reply_to_message_id);

ALTER TABLE public.peer_messages ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_messages;

CREATE POLICY "Users can view messages in their conversations"
  ON public.peer_messages
  FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
  );

CREATE POLICY "Users can send messages in their conversations"
  ON public.peer_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
      AND (participant1_id = receiver_id OR participant2_id = receiver_id)
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.peer_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON public.peer_messages
  FOR DELETE
  USING (sender_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.peer_message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.peer_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL CHECK (length(emoji) <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Each user can only have one of each emoji per message
  CONSTRAINT unique_user_emoji_per_message UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_peer_message_reactions_message ON public.peer_message_reactions(message_id);
CREATE INDEX idx_peer_message_reactions_user ON public.peer_message_reactions(user_id);

ALTER TABLE public.peer_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions in their conversations"
  ON public.peer_message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_messages pm
      WHERE pm.id = peer_message_reactions.message_id
      AND (pm.sender_id = auth.uid() OR pm.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can add reactions to messages in their conversations"
  ON public.peer_message_reactions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.peer_messages pm
      WHERE pm.id = message_id
      AND (pm.sender_id = auth.uid() OR pm.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete their own reactions"
  ON public.peer_message_reactions
  FOR DELETE
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.peer_message_read_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.peer_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Each user can only mark a message as read once
  CONSTRAINT unique_user_read_receipt UNIQUE (message_id, user_id)
);

CREATE INDEX idx_peer_message_read_receipts_message ON public.peer_message_read_receipts(message_id);
CREATE INDEX idx_peer_message_read_receipts_user ON public.peer_message_read_receipts(user_id);

ALTER TABLE public.peer_message_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view read receipts in their conversations"
  ON public.peer_message_read_receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_messages pm
      WHERE pm.id = peer_message_read_receipts.message_id
      AND (pm.sender_id = auth.uid() OR pm.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can add read receipts to messages in their conversations"
  ON public.peer_message_read_receipts
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.peer_messages pm
      WHERE pm.id = message_id
      AND (pm.sender_id = auth.uid() OR pm.receiver_id = auth.uid())
    )
  );

CREATE TABLE IF NOT EXISTS public.peer_message_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.peer_messages(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_peer_message_attachments_message ON public.peer_message_attachments(message_id);

ALTER TABLE public.peer_message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their conversations"
  ON public.peer_message_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_messages pm
      WHERE pm.id = peer_message_attachments.message_id
      AND (pm.sender_id = auth.uid() OR pm.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert attachments for their messages"
  ON public.peer_message_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.peer_messages pm
      WHERE pm.id = peer_message_attachments.message_id
      AND pm.sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own attachments"
  ON public.peer_message_attachments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_messages pm
      WHERE pm.id = peer_message_attachments.message_id
      AND pm.sender_id = auth.uid()
    )
  );

-- Create helper function to get or create conversation between two users
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  user1_id UUID,
  user2_id UUID
) RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  p1_id UUID;
  p2_id UUID;
BEGIN
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

-- Create trigger to update last_message_at when new message is sent
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_timestamp
  AFTER INSERT ON public.peer_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();
