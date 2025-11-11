-- Create buildings table
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  
  -- Address information (manual entry only)
  street_name TEXT,
  house_number TEXT,
  apartment_count INTEGER,
  city TEXT NOT NULL,
  county TEXT,
  postal_code TEXT,
  full_address TEXT NOT NULL,
  
  -- Creator/manager information
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_buildings_manager_id ON public.buildings(manager_id);
CREATE INDEX idx_buildings_city ON public.buildings(city);

-- RLS Policies
-- Everyone can view buildings (needed for residents to see their building)
CREATE POLICY "Anyone can view buildings"
  ON public.buildings
  FOR SELECT
  USING (true);

-- Authenticated users can only insert buildings for themselves
CREATE POLICY "Users can only insert buildings for themselves"
  ON public.buildings
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND manager_id = auth.uid()
  );

-- Only the user who added the building can update it
CREATE POLICY "Building creators can update their buildings"
  ON public.buildings
  FOR UPDATE
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- Only the user who added the building can delete it
CREATE POLICY "Building creators can delete their buildings"
  ON public.buildings
  FOR DELETE
  USING (manager_id = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER set_buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create building_residents junction table to link residents to buildings
CREATE TABLE IF NOT EXISTS public.building_residents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  apartment_number TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure a user can only be linked to a building once
  UNIQUE(building_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.building_residents ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_building_residents_building_id ON public.building_residents(building_id);
CREATE INDEX idx_building_residents_profile_id ON public.building_residents(profile_id);

-- RLS Policies for building_residents
-- Users can view their own building relationships
CREATE POLICY "Users can view their own building relationships"
  ON public.building_residents
  FOR SELECT
  USING (profile_id = auth.uid());

-- Building managers can view all residents of their buildings
CREATE POLICY "Building managers can view their building residents"
  ON public.building_residents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = building_residents.building_id
      AND manager_id = auth.uid()
    )
  );

-- Users can insert themselves as residents (pending approval)
CREATE POLICY "Users can add themselves as residents"
  ON public.building_residents
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Building managers can update resident status (e.g., approve)
CREATE POLICY "Building managers can update their building residents"
  ON public.building_residents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = building_residents.building_id
      AND manager_id = auth.uid()
    )
  );

-- Users can remove themselves, managers can remove their building's residents
CREATE POLICY "Users can delete their own relationships"
  ON public.building_residents
  FOR DELETE
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.buildings
      WHERE id = building_residents.building_id
      AND manager_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE TRIGGER set_building_residents_updated_at
  BEFORE UPDATE ON public.building_residents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
