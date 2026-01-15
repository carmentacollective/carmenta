DO $$ BEGIN
    CREATE TYPE "public"."connection_source" AS ENUM('carmenta', 'openai', 'anthropic');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN IF NOT EXISTS "source" "connection_source" DEFAULT 'carmenta' NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN IF NOT EXISTS "external_id" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN IF NOT EXISTS "imported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN IF NOT EXISTS "custom_gpt_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "connections_source_external_id_idx" ON "connections" USING btree ("user_id","source","external_id");