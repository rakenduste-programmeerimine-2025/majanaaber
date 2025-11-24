-- Create notices table
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_notices_building_id ON public.notices(building_id);
CREATE INDEX idx_notices_created_by ON public.notices(created_by);
CREATE INDEX idx_notices_created_at ON public.notices(created_at DESC);

-- RLS Policies

-- Anyone can view notices for buildings they have access to
-- (This will be used by both managers and residents)
CREATE POLICY "Users can view notices for their buildings"
  ON public.notices
  FOR SELECT
  USING (
    -- Building managers can see notices for their buildings
    EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = notices.building_id
      AND manager_id = auth.uid()
    )
    OR
    -- Residents can see notices for buildings they belong to
    EXISTS (
      SELECT 1 FROM public.building_residents
      WHERE building_id = notices.building_id
      AND profile_id = auth.uid()
      AND is_approved = true
    )
  );

-- Only building managers can create notices for their buildings
CREATE POLICY "Building managers can create notices"
  ON public.notices
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = notices.building_id
      AND manager_id = auth.uid()
    )
  );

-- Only the creator or building manager can update notices
CREATE POLICY "Notice creators and building managers can update notices"
  ON public.notices
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = notices.building_id
      AND manager_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = notices.building_id
      AND manager_id = auth.uid()
    )
  );

-- Only the creator or building manager can delete notices
CREATE POLICY "Notice creators and building managers can delete notices"
  ON public.notices
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = notices.building_id
      AND manager_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE TRIGGER set_notices_updated_at
  BEFORE UPDATE ON public.notices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add DATE to notices table
ALTER TABLE public.notices
ADD COLUMN event_date DATE;