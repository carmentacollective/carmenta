-- Drop foreign key constraint first
ALTER TABLE "message_parts" DROP CONSTRAINT IF EXISTS "message_parts_message_id_messages_id_fk";--> statement-breakpoint

-- Change parent column type first (messages.id)
ALTER TABLE "messages" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint

-- Then change child column type (message_parts.message_id)
ALTER TABLE "message_parts" ALTER COLUMN "message_id" SET DATA TYPE text;--> statement-breakpoint

-- Re-add foreign key constraint
ALTER TABLE "message_parts" ADD CONSTRAINT "message_parts_message_id_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE;