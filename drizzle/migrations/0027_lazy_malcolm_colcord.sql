CREATE TYPE "public"."connection_source" AS ENUM('carmenta', 'openai', 'anthropic');--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "source" "connection_source" DEFAULT 'carmenta' NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "imported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "custom_gpt_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "connections_source_external_id_idx" ON "connections" USING btree ("user_id","source","external_id");