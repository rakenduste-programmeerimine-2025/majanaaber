-- Create notice_read_receipts table to track when users read notices
CREATE TABLE notice_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notice_id, user_id)
);

-- Add index for faster lookups
CREATE INDEX idx_notice_read_receipts_notice_id ON notice_read_receipts(notice_id);
CREATE INDEX idx_notice_read_receipts_user_id ON notice_read_receipts(user_id);

-- Enable RLS
ALTER TABLE notice_read_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone in the building can view read receipts for notices
CREATE POLICY "Users can view read receipts in their building"
  ON notice_read_receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notices n
      JOIN building_residents br ON br.building_id = n.building_id
      WHERE n.id = notice_read_receipts.notice_id
        AND br.profile_id = auth.uid()
        AND br.is_approved = true
    )
    OR EXISTS (
      SELECT 1 FROM notices n
      JOIN buildings b ON b.id = n.building_id
      WHERE n.id = notice_read_receipts.notice_id
        AND b.manager_id = auth.uid()
    )
  );

-- Policy: Users can mark notices as read for themselves
CREATE POLICY "Users can mark notices as read in their building"
  ON notice_read_receipts
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM notices n
        JOIN building_residents br ON br.building_id = n.building_id
        WHERE n.id = notice_id
          AND br.profile_id = auth.uid()
          AND br.is_approved = true
      )
      OR EXISTS (
        SELECT 1 FROM notices n
        JOIN buildings b ON b.id = n.building_id
        WHERE n.id = notice_id
          AND b.manager_id = auth.uid()
      )
    )
  );
