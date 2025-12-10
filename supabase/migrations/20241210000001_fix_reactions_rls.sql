-- Fix RLS policies for message_reactions and peer_message_reactions
-- Issue: Users could only see their own reactions, not reactions from other users

-- =====================================================
-- FIX MESSAGE_REACTIONS POLICY
-- =====================================================

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Users can manage reactions in their buildings" ON public.message_reactions;

-- Create SELECT policy: Users can see ALL reactions on messages in their buildings
CREATE POLICY "Users can view reactions in their buildings"
  ON public.message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.building_messages bm
      JOIN public.buildings b ON bm.building_id = b.id
      WHERE bm.id = message_reactions.message_id
      AND (
        b.manager_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.building_residents br
          WHERE br.building_id = b.id
          AND br.profile_id = auth.uid()
          AND br.is_approved = true
        )
      )
    )
  );

-- Create INSERT policy: Users can add their own reactions in their buildings
CREATE POLICY "Users can add reactions in their buildings"
  ON public.message_reactions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.building_messages bm
      JOIN public.buildings b ON bm.building_id = b.id
      WHERE bm.id = message_reactions.message_id
      AND (
        b.manager_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.building_residents br
          WHERE br.building_id = b.id
          AND br.profile_id = auth.uid()
          AND br.is_approved = true
        )
      )
    )
  );

-- Create DELETE policy: Users can only delete their own reactions
CREATE POLICY "Users can delete their own reactions"
  ON public.message_reactions
  FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- FIX PEER_MESSAGE_REACTIONS POLICY
-- =====================================================

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Users can manage reactions on peer messages they have access to" ON public.peer_message_reactions;

-- Create SELECT policy: Users can see ALL reactions on peer messages they have access to
CREATE POLICY "Users can view reactions on peer messages"
  ON public.peer_message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.peer_messages pm
      JOIN public.conversations c ON pm.conversation_id = c.id
      WHERE pm.id = peer_message_reactions.message_id
      AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );

-- Create INSERT policy: Users can add their own reactions on peer messages
CREATE POLICY "Users can add reactions on peer messages"
  ON public.peer_message_reactions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.peer_messages pm
      JOIN public.conversations c ON pm.conversation_id = c.id
      WHERE pm.id = peer_message_reactions.message_id
      AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );

-- Create DELETE policy: Users can only delete their own reactions
CREATE POLICY "Users can delete their own peer message reactions"
  ON public.peer_message_reactions
  FOR DELETE
  USING (user_id = auth.uid());
