-- Create building_messages table for building-wide chat
CREATE TABLE IF NOT EXISTS public.building_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent empty messages and enforce max length
  CONSTRAINT non_empty_content CHECK (length(trim(content)) > 0),
  CONSTRAINT content_max_length CHECK (length(content) <= 1000)
);

-- Enable RLS
ALTER TABLE public.building_messages ENABLE ROW LEVEL SECURITY;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.building_messages;

-- Create indexes
CREATE INDEX idx_building_messages_building_id ON public.building_messages(building_id);
CREATE INDEX idx_building_messages_created_at ON public.building_messages(created_at DESC);
CREATE INDEX idx_building_messages_sender_id ON public.building_messages(sender_id);

-- RLS Policies

-- Approved residents and building managers can view messages in their buildings
CREATE POLICY "Users can view messages in their buildings"
  ON public.building_messages
  FOR SELECT
  USING (
    -- Building managers can see messages for their buildings
    EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = building_messages.building_id
      AND manager_id = auth.uid()
    )
    OR
    -- Approved residents can see messages for buildings they belong to
    EXISTS (
      SELECT 1 FROM public.building_residents
      WHERE building_id = building_messages.building_id
      AND profile_id = auth.uid()
      AND is_approved = true
    )
  );

-- Approved residents and managers can insert messages in their buildings
CREATE POLICY "Approved users can send messages in their buildings"
  ON public.building_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender_id = auth.uid()
    AND (
      -- Building managers can send messages
      EXISTS (
        SELECT 1 FROM public.buildings
        WHERE id = building_messages.building_id
        AND manager_id = auth.uid()
      )
      OR
      -- Approved residents can send messages
      EXISTS (
        SELECT 1 FROM public.building_residents
        WHERE building_id = building_messages.building_id
        AND profile_id = auth.uid()
        AND is_approved = true
      )
    )
  );

-- Users can update their own messages (for future edit functionality)
CREATE POLICY "Users can update their own messages"
  ON public.building_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Users can delete their own messages, managers can delete any message in their buildings
CREATE POLICY "Users can delete their own messages or managers can delete any"
  ON public.building_messages
  FOR DELETE
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = building_messages.building_id
      AND manager_id = auth.uid()
    )
  );
