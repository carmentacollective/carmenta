-- Migrate event_source: Map nango_webhook to system before recreating enum
ALTER TABLE "integration_history" ALTER COLUMN "event_source" SET DATA TYPE text;--> statement-breakpoint
UPDATE "integration_history" SET "event_source" = 'system' WHERE "event_source" = 'nango_webhook';--> statement-breakpoint
DROP TYPE "public"."integration_event_source";--> statement-breakpoint
CREATE TYPE "public"."integration_event_source" AS ENUM('user', 'system');--> statement-breakpoint
ALTER TABLE "integration_history" ALTER COLUMN "event_source" SET DATA TYPE "public"."integration_event_source" USING "event_source"::"public"."integration_event_source";--> statement-breakpoint

-- Migrate event_type: Map old Nango events to semantic equivalents before recreating enum
ALTER TABLE "integration_history" ALTER COLUMN "event_type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "integration_history" SET "event_type" = 'reconnected' WHERE "event_type" = 'nango_token_refresh';--> statement-breakpoint
UPDATE "integration_history" SET "event_type" = 'connected' WHERE "event_type" IN ('nango_sync_success', 'nango_connection_created');--> statement-breakpoint
UPDATE "integration_history" SET "event_type" = 'connection_error' WHERE "event_type" IN ('nango_sync_error', 'nango_connection_error');--> statement-breakpoint
DROP TYPE "public"."integration_event_type";--> statement-breakpoint
CREATE TYPE "public"."integration_event_type" AS ENUM('connected', 'disconnected', 'reconnected', 'token_expired', 'connection_error', 'rate_limited');--> statement-breakpoint
ALTER TABLE "integration_history" ALTER COLUMN "event_type" SET DATA TYPE "public"."integration_event_type" USING "event_type"::"public"."integration_event_type";--> statement-breakpoint
ALTER TABLE "integration_history" DROP COLUMN "connection_id";--> statement-breakpoint
ALTER TABLE "integration_history" DROP COLUMN "nango_provider_config_key";--> statement-breakpoint
ALTER TABLE "integrations" DROP COLUMN "connection_id";