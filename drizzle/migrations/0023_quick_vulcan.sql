CREATE TYPE "public"."mcp_connection_event_source" AS ENUM('user', 'system', 'agent');--> statement-breakpoint
CREATE TYPE "public"."mcp_connection_event_type" AS ENUM('connected', 'disconnected', 'reconnected', 'token_expired', 'connection_error', 'tools_discovered');--> statement-breakpoint
CREATE TYPE "public"."mcp_server_auth_type" AS ENUM('none', 'bearer', 'header', 'oauth');--> statement-breakpoint
CREATE TYPE "public"."mcp_server_status" AS ENUM('connected', 'disconnected', 'error', 'expired');--> statement-breakpoint
CREATE TYPE "public"."mcp_server_transport" AS ENUM('sse', 'http');--> statement-breakpoint
CREATE TABLE "mcp_connection_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mcp_connection_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_email" varchar(255) NOT NULL,
	"server_identifier" varchar(255) NOT NULL,
	"account_id" varchar(255),
	"event_type" "mcp_connection_event_type" NOT NULL,
	"event_source" "mcp_connection_event_source" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mcp_servers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_email" varchar(255) NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"account_id" varchar(255) DEFAULT 'default' NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"account_display_name" varchar(255),
	"url" varchar(2048) NOT NULL,
	"transport" "mcp_server_transport" DEFAULT 'sse' NOT NULL,
	"auth_type" "mcp_server_auth_type" DEFAULT 'none' NOT NULL,
	"encrypted_credentials" text,
	"auth_header_name" varchar(255),
	"is_default" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"status" "mcp_server_status" DEFAULT 'connected' NOT NULL,
	"error_message" text,
	"server_manifest" jsonb,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_connection_events" ADD CONSTRAINT "mcp_connection_events_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_connection_events_user_email_occurred_at_idx" ON "mcp_connection_events" USING btree ("user_email","occurred_at");--> statement-breakpoint
CREATE INDEX "mcp_connection_events_server_identifier_idx" ON "mcp_connection_events" USING btree ("server_identifier");--> statement-breakpoint
CREATE INDEX "mcp_servers_user_email_idx" ON "mcp_servers" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "mcp_servers_user_email_identifier_idx" ON "mcp_servers" USING btree ("user_email","identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_servers_user_email_identifier_account_idx" ON "mcp_servers" USING btree ("user_email","identifier","account_id");