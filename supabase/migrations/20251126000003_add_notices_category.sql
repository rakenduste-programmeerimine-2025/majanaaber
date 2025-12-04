-- Add category column to notices table
-- Values: 'general', 'maintenance', 'meeting', 'payment', 'safety', 'event'
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Add check constraint for valid category values
ALTER TABLE public.notices ADD CONSTRAINT notices_category_check
  CHECK (category IN ('general', 'maintenance', 'meeting', 'payment', 'safety', 'event'));

-- Create index for category-based filtering
CREATE INDEX IF NOT EXISTS idx_notices_category ON public.notices(category);
