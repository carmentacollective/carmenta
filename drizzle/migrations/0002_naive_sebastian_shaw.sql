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
ALTER TABLE "integrations" RENAME COLUMN "user_id" TO "user_email";--> statement-breakpoint
ALTER TABLE "integrations" DROP CONSTRAINT "integrations_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "integrations_user_idx";--> statement-breakpoint
DROP INDEX "integrations_user_service_idx";--> statement-breakpoint
DROP INDEX "integrations_user_service_account_idx";--> statement-breakpoint
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