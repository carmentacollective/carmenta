CREATE TYPE "public"."sms_notification_source" AS ENUM('scheduled_agent', 'alert', 'briefing', 'reminder', 'verification');--> statement-breakpoint
CREATE TABLE "sms_outbound_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sms_outbound_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"quo_message_id" varchar(100),
	"user_email" varchar(255) NOT NULL,
	"to_phone" varchar(20) NOT NULL,
	"from_phone" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"source" "sms_notification_source" NOT NULL,
	"conversation_id" integer,
	"job_run_id" uuid,
	"delivery_status" "sms_delivery_status" DEFAULT 'queued' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"error_message" text,
	"context_window_ends" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_phone_numbers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_phone_numbers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_email" varchar(255) NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sms_opt_in" boolean DEFAULT false NOT NULL,
	"opted_in_at" timestamp with time zone,
	"opt_in_source" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_outbound_messages" ADD CONSTRAINT "sms_outbound_messages_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_outbound_messages" ADD CONSTRAINT "sms_outbound_messages_conversation_id_connections_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_outbound_messages" ADD CONSTRAINT "sms_outbound_messages_job_run_id_job_runs_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_phone_numbers" ADD CONSTRAINT "user_phone_numbers_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_outbound_quo_message_idx" ON "sms_outbound_messages" USING btree ("quo_message_id");--> statement-breakpoint
CREATE INDEX "sms_outbound_user_email_idx" ON "sms_outbound_messages" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "sms_outbound_context_window_idx" ON "sms_outbound_messages" USING btree ("user_email","context_window_ends");--> statement-breakpoint
CREATE INDEX "sms_outbound_retry_idx" ON "sms_outbound_messages" USING btree ("delivery_status","next_retry_at");--> statement-breakpoint
CREATE INDEX "user_phone_numbers_phone_idx" ON "user_phone_numbers" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "user_phone_numbers_user_email_idx" ON "user_phone_numbers" USING btree ("user_email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_phone_numbers_user_phone_idx" ON "user_phone_numbers" USING btree ("user_email","phone_number");