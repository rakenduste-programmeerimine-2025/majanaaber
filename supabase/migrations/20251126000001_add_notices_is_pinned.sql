-- Add is_pinned column to notices table
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Create index for efficient pinned notices queries
CREATE INDEX IF NOT EXISTS idx_notices_is_pinned ON public.notices(is_pinned DESC, created_at DESC);
