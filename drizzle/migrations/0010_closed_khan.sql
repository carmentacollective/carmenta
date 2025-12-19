-- Migration 0010: Remove Nango remnants (simplified - just drop old data)
-- Nick is the only user and is fine reconnecting integrations

-- Clear integration history - easier than migrating old enum values
TRUNCATE TABLE "integration_history";--> statement-breakpoint

-- Recreate event_source enum cleanly
DROP TYPE IF EXISTS "public"."integration_event_source" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."integration_event_source" AS ENUM('user', 'system');--> statement-breakpoint

-- Recreate event_type enum cleanly
DROP TYPE IF EXISTS "public"."integration_event_type" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."integration_event_type" AS ENUM('connected', 'disconnected', 'reconnected', 'token_expired', 'connection_error', 'rate_limited');--> statement-breakpoint

-- Drop Nango columns if they exist
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integration_history' AND column_name = 'connection_id') THEN
        ALTER TABLE "integration_history" DROP COLUMN "connection_id";
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integration_history' AND column_name = 'nango_provider_config_key') THEN
        ALTER TABLE "integration_history" DROP COLUMN "nango_provider_config_key";
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'connection_id') THEN
        ALTER TABLE "integrations" DROP COLUMN "connection_id";
    END IF;
END $$;
