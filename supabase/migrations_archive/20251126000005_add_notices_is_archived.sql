-- Add is_archived column to notices table
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create index for efficient archived queries
CREATE INDEX IF NOT EXISTS idx_notices_is_archived ON public.notices(is_archived);
