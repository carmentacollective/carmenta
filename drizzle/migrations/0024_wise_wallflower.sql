CREATE TYPE "public"."sms_delivery_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sms_processing_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "sms_inbound_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"quo_message_id" varchar(100) NOT NULL,
	"from_phone" varchar(20) NOT NULL,
	"to_phone" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"quo_phone_number_id" varchar(100),
	"processing_status" "sms_processing_status" DEFAULT 'pending' NOT NULL,
	"user_email" varchar(255),
	"error_message" text,
	"quo_created_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "sms_inbound_messages_quo_message_id_unique" UNIQUE("quo_message_id")
);
--> statement-breakpoint
CREATE TABLE "unknown_sms_senders" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_prompted_at" timestamp with time zone,
	"message_count" integer DEFAULT 0 NOT NULL,
	"blocked_at" timestamp with time zone,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unknown_sms_senders_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
ALTER TABLE "sms_inbound_messages" ADD CONSTRAINT "sms_inbound_messages_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "public"."users"("email") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_inbound_quo_message_idx" ON "sms_inbound_messages" USING btree ("quo_message_id");--> statement-breakpoint
CREATE INDEX "sms_inbound_from_phone_idx" ON "sms_inbound_messages" USING btree ("from_phone");--> statement-breakpoint
CREATE INDEX "sms_inbound_user_email_idx" ON "sms_inbound_messages" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "sms_inbound_received_at_idx" ON "sms_inbound_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "unknown_sms_senders_phone_idx" ON "unknown_sms_senders" USING btree ("phone_number");