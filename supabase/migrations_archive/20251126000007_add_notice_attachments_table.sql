-- Create notice_attachments table for multiple attachments per notice
-- This replaces the single attachment columns on notices table

CREATE TABLE IF NOT EXISTS public.notice_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notice_attachments_notice_id ON public.notice_attachments(notice_id);

-- Enable RLS
ALTER TABLE public.notice_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notice_attachments
-- Everyone can view attachments for notices in buildings they belong to
CREATE POLICY "Users can view notice attachments for their buildings"
ON public.notice_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.notices n
    JOIN public.buildings b ON n.building_id = b.id
    WHERE n.id = notice_attachments.notice_id
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

-- Building managers can insert attachments
CREATE POLICY "Building managers can insert notice attachments"
ON public.notice_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.notices n
    JOIN public.buildings b ON n.building_id = b.id
    WHERE n.id = notice_attachments.notice_id
    AND b.manager_id = auth.uid()
  )
);

-- Building managers can delete attachments
CREATE POLICY "Building managers can delete notice attachments"
ON public.notice_attachments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.notices n
    JOIN public.buildings b ON n.building_id = b.id
    WHERE n.id = notice_attachments.notice_id
    AND b.manager_id = auth.uid()
  )
);
