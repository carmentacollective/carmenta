ALTER TABLE "integration_history" ALTER COLUMN "event_source" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."integration_event_source";--> statement-breakpoint
CREATE TYPE "public"."integration_event_source" AS ENUM('user', 'system');--> statement-breakpoint
ALTER TABLE "integration_history" ALTER COLUMN "event_source" SET DATA TYPE "public"."integration_event_source" USING "event_source"::"public"."integration_event_source";--> statement-breakpoint
ALTER TABLE "integration_history" ALTER COLUMN "event_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."integration_event_type";--> statement-breakpoint
CREATE TYPE "public"."integration_event_type" AS ENUM('connected', 'disconnected', 'reconnected', 'token_expired', 'connection_error', 'rate_limited');--> statement-breakpoint
ALTER TABLE "integration_history" ALTER COLUMN "event_type" SET DATA TYPE "public"."integration_event_type" USING "event_type"::"public"."integration_event_type";--> statement-breakpoint
ALTER TABLE "integration_history" DROP COLUMN "connection_id";--> statement-breakpoint
ALTER TABLE "integration_history" DROP COLUMN "nango_provider_config_key";--> statement-breakpoint
ALTER TABLE "integrations" DROP COLUMN "connection_id";