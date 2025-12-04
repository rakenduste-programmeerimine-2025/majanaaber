-- Add UPDATE policy for notice_read_receipts to support upsert operations
-- The upsert in use-notice-read-receipts.ts requires both INSERT and UPDATE policies

CREATE POLICY "Users can update their own read receipts"
  ON notice_read_receipts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
