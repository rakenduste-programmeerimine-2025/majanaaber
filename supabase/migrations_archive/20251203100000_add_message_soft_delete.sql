-- Add soft delete support to building_messages and peer_messages tables
-- Instead of deleting messages, mark them as deleted to show "This message was deleted"

-- Add is_deleted column to building_messages
ALTER TABLE public.building_messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;

-- Add is_deleted column to peer_messages
ALTER TABLE public.peer_messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for filtering non-deleted messages
CREATE INDEX IF NOT EXISTS idx_building_messages_is_deleted ON public.building_messages(is_deleted);
CREATE INDEX IF NOT EXISTS idx_peer_messages_is_deleted ON public.peer_messages(is_deleted);
