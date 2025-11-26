-- Add attachment columns to notices table
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS attachment_url TEXT DEFAULT NULL;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS attachment_name TEXT DEFAULT NULL;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS attachment_type TEXT DEFAULT NULL;

-- Create storage bucket for notice attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('notice-attachments', 'notice-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for notice attachments
CREATE POLICY "Building managers can upload notice attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'notice-attachments'
  AND EXISTS (
    SELECT 1 FROM public.buildings
    WHERE manager_id = auth.uid()
  )
);

CREATE POLICY "Building managers can update their notice attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'notice-attachments'
  AND EXISTS (
    SELECT 1 FROM public.buildings
    WHERE manager_id = auth.uid()
  )
);

CREATE POLICY "Building managers can delete their notice attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'notice-attachments'
  AND EXISTS (
    SELECT 1 FROM public.buildings
    WHERE manager_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view notice attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'notice-attachments');
