CREATE TABLE message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES building_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);

ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their building"
  ON message_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM building_messages bm
      JOIN buildings b ON b.id = bm.building_id
      WHERE bm.id = message_attachments.message_id
      AND (
        b.manager_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM building_residents br
          WHERE br.building_id = b.id
          AND br.profile_id = auth.uid()
          AND br.is_approved = true
        )
      )
    )
  );

CREATE POLICY "Users can insert attachments for their messages"
  ON message_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM building_messages bm
      WHERE bm.id = message_attachments.message_id
      AND bm.sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own attachments"
  ON message_attachments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM building_messages bm
      WHERE bm.id = message_attachments.message_id
      AND bm.sender_id = auth.uid()
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload files to their building's messages"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view files from their building"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'message-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own uploaded files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'message-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
