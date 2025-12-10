-- Fix RLS policies for notice_attachments table
-- Issue: Missing policies causing INSERT to fail

-- Drop any existing policies (using IF EXISTS to be safe)
DROP POLICY IF EXISTS "Users can view notice attachments" ON public.notice_attachments;
DROP POLICY IF EXISTS "Users can view notice attachments for their buildings" ON public.notice_attachments;
DROP POLICY IF EXISTS "Building managers can create notice attachments" ON public.notice_attachments;
DROP POLICY IF EXISTS "Building managers can insert notice attachments" ON public.notice_attachments;
DROP POLICY IF EXISTS "Building managers can delete notice attachments" ON public.notice_attachments;

-- Create SELECT policy: Users can view attachments for notices in their buildings
CREATE POLICY "Users can view notice attachments for their buildings"
  ON public.notice_attachments
  FOR SELECT
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

-- Create INSERT policy: Building managers can create attachments for notices in their buildings
CREATE POLICY "Building managers can insert notice attachments"
  ON public.notice_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notices n
      JOIN public.buildings b ON n.building_id = b.id
      WHERE n.id = notice_attachments.notice_id
      AND b.manager_id = auth.uid()
    )
  );

-- Create DELETE policy: Building managers can delete attachments for notices in their buildings
CREATE POLICY "Building managers can delete notice attachments"
  ON public.notice_attachments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.notices n
      JOIN public.buildings b ON n.building_id = b.id
      WHERE n.id = notice_attachments.notice_id
      AND b.manager_id = auth.uid()
    )
  );
