CREATE TYPE "public"."integration_event_source" AS ENUM('user', 'nango_webhook', 'system');--> statement-breakpoint
CREATE TYPE "public"."integration_event_type" AS ENUM('connected', 'disconnected', 'reconnected', 'nango_sync_success', 'nango_sync_error', 'nango_auth_error', 'nango_token_refresh', 'nango_connection_created', 'nango_connection_deleted', 'token_expired', 'connection_error', 'rate_limited');--> statement-breakpoint
CREATE TABLE "integration_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"service" varchar(100) NOT NULL,
	"account_id" varchar(255),
	"account_display_name" varchar(255),
	"event_type" "integration_event_type" NOT NULL,
	"event_source" "integration_event_source" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"connection_id" varchar(255),
	"nango_provider_config_key" varchar(255),
	"error_message" text,
	"error_code" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Step 1: Add new user_email column
ALTER TABLE "integrations" ADD COLUMN "user_email" varchar(255);--> statement-breakpoint

-- Step 2: Populate user_email from users table via user_id
UPDATE "integrations" i
SET "user_email" = u."email"
FROM "users" u
WHERE i."user_id" = u."id";--> statement-breakpoint

-- Step 2.5: Validate no orphaned records before setting NOT NULL
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM "integrations"
  WHERE "user_email" IS NULL;

  IF orphaned_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % orphaned integration records found with no matching user. Clean up orphaned records before proceeding.', orphaned_count;
  END IF;
END $$;--> statement-breakpoint

-- Step 3: Make user_email NOT NULL (safe now that it's populated and validated)
ALTER TABLE "integrations" ALTER COLUMN "user_email" SET NOT NULL;--> statement-breakpoint

-- Step 4: Drop old constraints and indexes
ALTER TABLE "integrations" DROP CONSTRAINT "integrations_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "integrations_user_idx";--> statement-breakpoint
DROP INDEX "integrations_user_service_idx";--> statement-breakpoint
DROP INDEX "integrations_user_service_account_idx";--> statement-breakpoint

-- Step 5: Drop old user_id column
ALTER TABLE "integrations" DROP COLUMN "user_id";--> statement-breakpoint

-- Step 6: Add last_sync_at column
ALTER TABLE "integrations" ADD COLUMN "last_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_history" ADD CONSTRAINT "integration_history_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_history_user_email_occurred_at_idx" ON "integration_history" USING btree ("user_email","occurred_at");--> statement-breakpoint
CREATE INDEX "integration_history_service_occurred_at_idx" ON "integration_history" USING btree ("service","occurred_at");--> statement-breakpoint
CREATE INDEX "integration_history_event_type_occurred_at_idx" ON "integration_history" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "integration_history_user_email_service_idx" ON "integration_history" USING btree ("user_email","service");--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integrations_user_email_idx" ON "integrations" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "integrations_user_email_service_idx" ON "integrations" USING btree ("user_email","service");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_user_email_service_account_idx" ON "integrations" USING btree ("user_email","service","account_id");