CREATE TYPE "public"."connection_status" AS ENUM('active', 'background', 'archived');--> statement-breakpoint
CREATE TYPE "public"."credential_type" AS ENUM('oauth', 'api_key');--> statement-breakpoint
CREATE TYPE "public"."document_source_type" AS ENUM('manual', 'seed', 'system_docs', 'conversation_extraction', 'conversation_decision', 'conversation_commitment', 'uploaded_pdf', 'uploaded_image', 'uploaded_audio', 'uploaded_document', 'uploaded_text', 'integration_limitless', 'integration_fireflies', 'integration_gmail', 'integration_slack', 'integration_notion');--> statement-breakpoint
CREATE TYPE "public"."integration_event_source" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."integration_event_type" AS ENUM('connected', 'disconnected', 'reconnected', 'token_expired', 'connection_error', 'rate_limited');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connected', 'error', 'expired', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."part_type" AS ENUM('text', 'reasoning', 'tool_call', 'file', 'data', 'step_start');--> statement-breakpoint
CREATE TYPE "public"."streaming_status" AS ENUM('idle', 'streaming', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tool_state" AS ENUM('input_streaming', 'input_available', 'output_available', 'output_error');--> statement-breakpoint
CREATE TABLE "connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(500),
	"title_edited" boolean DEFAULT false NOT NULL,
	"slug" varchar(255) NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"streaming_status" "streaming_status" DEFAULT 'idle' NOT NULL,
	"model_id" varchar(255),
	"concierge_model_id" varchar(255),
	"concierge_temperature" numeric(3, 2),
	"concierge_explanation" text,
	"concierge_reasoning" jsonb,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"starred_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"path" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', content)) STORED NOT NULL,
	"description" text,
	"prompt_label" varchar(50),
	"prompt_hint" text,
	"prompt_order" integer DEFAULT 0,
	"always_include" boolean DEFAULT false NOT NULL,
	"searchable" boolean DEFAULT false NOT NULL,
	"editable" boolean DEFAULT true NOT NULL,
	"source_type" "document_source_type" DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"service" varchar(100) NOT NULL,
	"account_id" varchar(255),
	"account_display_name" varchar(255),
	"event_type" "integration_event_type" NOT NULL,
	"event_source" "integration_event_source" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text,
	"error_code" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"service" varchar(100) NOT NULL,
	"encrypted_credentials" text,
	"credential_type" "credential_type" NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"account_display_name" varchar(255),
	"is_default" boolean DEFAULT false NOT NULL,
	"status" "integration_status" DEFAULT 'connected' NOT NULL,
	"error_message" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"type" "part_type" NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"text_content" text,
	"reasoning_content" text,
	"tool_call" jsonb,
	"file_media_type" varchar(255),
	"file_name" varchar(1024),
	"file_url" varchar(4096),
	"data_content" jsonb,
	"provider_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"role" "message_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(255) NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"return_url" varchar(2048),
	"code_verifier" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"display_name" varchar(255),
	"image_url" varchar(2048),
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"last_signed_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_history" ADD CONSTRAINT "integration_history_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_parts" ADD CONSTRAINT "message_parts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connections_user_last_activity_idx" ON "connections" USING btree ("user_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "connections_user_status_idx" ON "connections" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "connections_streaming_status_idx" ON "connections" USING btree ("streaming_status");--> statement-breakpoint
CREATE INDEX "connections_slug_idx" ON "connections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "connections_user_starred_idx" ON "connections" USING btree ("user_id","is_starred","last_activity_at");--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_user_path_unique_idx" ON "documents" USING btree ("user_id","path");--> statement-breakpoint
CREATE INDEX "documents_tags_idx" ON "documents" USING btree ("tags");--> statement-breakpoint
CREATE INDEX "documents_always_include_idx" ON "documents" USING btree ("user_id","always_include");--> statement-breakpoint
CREATE INDEX "documents_search_vector_idx" ON "documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "integration_history_user_email_occurred_at_idx" ON "integration_history" USING btree ("user_email","occurred_at");--> statement-breakpoint
CREATE INDEX "integration_history_service_occurred_at_idx" ON "integration_history" USING btree ("service","occurred_at");--> statement-breakpoint
CREATE INDEX "integration_history_event_type_occurred_at_idx" ON "integration_history" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "integration_history_user_email_service_idx" ON "integration_history" USING btree ("user_email","service");--> statement-breakpoint
CREATE INDEX "integrations_user_email_idx" ON "integrations" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "integrations_user_email_service_idx" ON "integrations" USING btree ("user_email","service");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_user_email_service_account_idx" ON "integrations" USING btree ("user_email","service","account_id");--> statement-breakpoint
CREATE INDEX "message_parts_message_idx" ON "message_parts" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_parts_message_order_idx" ON "message_parts" USING btree ("message_id","order");--> statement-breakpoint
CREATE INDEX "messages_connection_idx" ON "messages" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "messages_connection_created_idx" ON "messages" USING btree ("connection_id","created_at");--> statement-breakpoint
CREATE INDEX "oauth_states_state_idx" ON "oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");