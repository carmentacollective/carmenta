-- Rename conversations table to connections
-- This is a full rename including the enum type, table, columns, and indexes

-- Step 1: Rename the enum type
ALTER TYPE "conversation_status" RENAME TO "connection_status";

-- Step 2: Drop existing indexes (we'll recreate with new names)
DROP INDEX IF EXISTS "conversations_user_last_activity_idx";
DROP INDEX IF EXISTS "conversations_user_status_idx";
DROP INDEX IF EXISTS "conversations_streaming_status_idx";
DROP INDEX IF EXISTS "messages_conversation_idx";
DROP INDEX IF EXISTS "messages_conversation_created_idx";

-- Step 3: Drop foreign key constraints
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_conversation_id_conversations_id_fk";
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_user_id_users_id_fk";

-- Step 4: Rename the table
ALTER TABLE "conversations" RENAME TO "connections";

-- Step 5: Rename the column in messages table
ALTER TABLE "messages" RENAME COLUMN "conversation_id" TO "connection_id";

-- Step 6: Re-add foreign key constraints with new names
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "messages" ADD CONSTRAINT "messages_connection_id_connections_id_fk"
    FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;

-- Step 7: Recreate indexes with new names
CREATE INDEX "connections_user_last_activity_idx" ON "connections" USING btree ("user_id","last_activity_at");
CREATE INDEX "connections_user_status_idx" ON "connections" USING btree ("user_id","status");
CREATE INDEX "connections_streaming_status_idx" ON "connections" USING btree ("streaming_status");
CREATE INDEX "messages_connection_idx" ON "messages" USING btree ("connection_id");
CREATE INDEX "messages_connection_created_idx" ON "messages" USING btree ("connection_id","created_at");
