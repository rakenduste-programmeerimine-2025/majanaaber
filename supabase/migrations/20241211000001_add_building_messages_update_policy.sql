-- Add UPDATE policies for messages
-- This allows users to edit and delete (soft delete) their own messages

-- Building messages UPDATE policy
CREATE POLICY "Users can update their own messages"
  ON public.building_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Peer messages UPDATE policy
CREATE POLICY "Users can update their own peer messages"
  ON public.peer_messages
  FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
