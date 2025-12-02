-- Migration: Change messages.id from uuid to text
-- Reason: AI SDK generates nanoid-style IDs (e.g., "QgGEVohpfiFhLcW3"), not UUIDs
-- Date: 2025-12-02

-- Step 1: Drop foreign key constraint on message_parts
ALTER TABLE message_parts DROP CONSTRAINT IF EXISTS message_parts_message_id_messages_id_fk;

-- Step 2: Convert messages.id from uuid to text
ALTER TABLE messages ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE messages ALTER COLUMN id DROP DEFAULT;

-- Step 3: Convert message_parts.message_id from uuid to text
ALTER TABLE message_parts ALTER COLUMN message_id TYPE text USING message_id::text;

-- Step 4: Re-add foreign key constraint
ALTER TABLE message_parts ADD CONSTRAINT message_parts_message_id_messages_id_fk
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
