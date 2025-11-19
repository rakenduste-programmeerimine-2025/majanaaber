-- Create message_reactions table for emoji reactions on messages
CREATE TABLE message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES building_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (length(emoji) <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Add index for faster lookups
CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);

-- Enable RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone in the building can view reactions
CREATE POLICY "Users can view reactions in their building"
  ON message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM building_messages bm
      JOIN building_residents br ON br.building_id = bm.building_id
      WHERE bm.id = message_reactions.message_id
        AND br.profile_id = auth.uid()
        AND br.is_approved = true
    )
    OR EXISTS (
      SELECT 1 FROM building_messages bm
      JOIN buildings b ON b.id = bm.building_id
      WHERE bm.id = message_reactions.message_id
        AND b.manager_id = auth.uid()
    )
  );

-- Policy: Users can add their own reactions
CREATE POLICY "Users can add reactions to messages in their building"
  ON message_reactions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM building_messages bm
        JOIN building_residents br ON br.building_id = bm.building_id
        WHERE bm.id = message_id
          AND br.profile_id = auth.uid()
          AND br.is_approved = true
      )
      OR EXISTS (
        SELECT 1 FROM building_messages bm
        JOIN buildings b ON b.id = bm.building_id
        WHERE bm.id = message_id
          AND b.manager_id = auth.uid()
      )
    )
  );

-- Policy: Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions"
  ON message_reactions
  FOR DELETE
  USING (user_id = auth.uid());
