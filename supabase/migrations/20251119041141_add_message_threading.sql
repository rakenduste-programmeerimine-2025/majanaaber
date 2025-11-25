-- Add message threading/replies support to building_messages table

ALTER TABLE building_messages
ADD COLUMN reply_to_message_id uuid REFERENCES building_messages(id) ON DELETE SET NULL;

-- Add index for efficient reply lookups
CREATE INDEX idx_building_messages_reply_to ON building_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
