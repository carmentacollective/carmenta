CREATE TYPE "public"."conversation_status" AS ENUM('active', 'background', 'archived');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."part_type" AS ENUM('text', 'reasoning', 'tool_call', 'file', 'data', 'step_start');--> statement-breakpoint
CREATE TYPE "public"."streaming_status" AS ENUM('idle', 'streaming', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tool_state" AS ENUM('input_streaming', 'input_available', 'output_available', 'output_error');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(500),
	"status" "conversation_status" DEFAULT 'active' NOT NULL,
	"streaming_status" "streaming_status" DEFAULT 'idle' NOT NULL,
	"model_id" varchar(255),
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_parts" ADD CONSTRAINT "message_parts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_user_last_activity_idx" ON "conversations" USING btree ("user_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "conversations_user_status_idx" ON "conversations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "conversations_streaming_status_idx" ON "conversations" USING btree ("streaming_status");--> statement-breakpoint
CREATE INDEX "message_parts_message_idx" ON "message_parts" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_parts_message_order_idx" ON "message_parts" USING btree ("message_id","order");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");