-- Add priority column to notices table
-- Values: 'urgent', 'normal', 'low'
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Add check constraint for valid priority values
ALTER TABLE public.notices ADD CONSTRAINT notices_priority_check
  CHECK (priority IN ('urgent', 'normal', 'low'));

-- Create index for priority-based queries
CREATE INDEX IF NOT EXISTS idx_notices_priority ON public.notices(priority);
