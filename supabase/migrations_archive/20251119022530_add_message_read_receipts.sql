-- Create message_read_receipts table to track when users read messages
CREATE TABLE message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES building_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Add index for faster lookups
CREATE INDEX idx_message_read_receipts_message_id ON message_read_receipts(message_id);
CREATE INDEX idx_message_read_receipts_user_id ON message_read_receipts(user_id);

-- Enable RLS
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone in the building can view read receipts
CREATE POLICY "Users can view read receipts in their building"
  ON message_read_receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM building_messages bm
      JOIN building_residents br ON br.building_id = bm.building_id
      WHERE bm.id = message_read_receipts.message_id
        AND br.profile_id = auth.uid()
        AND br.is_approved = true
    )
    OR EXISTS (
      SELECT 1 FROM building_messages bm
      JOIN buildings b ON b.id = bm.building_id
      WHERE bm.id = message_read_receipts.message_id
        AND b.manager_id = auth.uid()
    )
  );

-- Policy: Users can mark messages as read for themselves
CREATE POLICY "Users can mark messages as read in their building"
  ON message_read_receipts
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
