-- Add expires_at column to notices table
-- Null means no expiration
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_notices_expires_at ON public.notices(expires_at);
