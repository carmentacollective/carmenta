CREATE TYPE "public"."credential_type" AS ENUM('oauth', 'api_key');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'error', 'expired', 'disconnected');--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"service" varchar(100) NOT NULL,
	"connection_id" varchar(255),
	"encrypted_credentials" text,
	"credential_type" "credential_type" NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"account_display_name" varchar(255),
	"is_default" boolean DEFAULT false NOT NULL,
	"status" "integration_status" DEFAULT 'connected' NOT NULL,
	"error_message" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integrations_user_idx" ON "integrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "integrations_user_service_idx" ON "integrations" USING btree ("user_id","service");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_user_service_account_idx" ON "integrations" USING btree ("user_id","service","account_id");