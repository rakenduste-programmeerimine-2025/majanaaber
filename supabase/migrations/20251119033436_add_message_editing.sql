-- Add message editing support to building_messages table

ALTER TABLE building_messages
ADD COLUMN edited_at timestamptz DEFAULT NULL;

-- Add index for edited_at for potential sorting/filtering
CREATE INDEX idx_building_messages_edited_at ON building_messages(edited_at) WHERE edited_at IS NOT NULL;
