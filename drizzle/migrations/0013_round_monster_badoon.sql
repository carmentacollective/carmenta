CREATE TYPE "public"."notification_source" AS ENUM('librarian', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('knowledge_created', 'knowledge_updated', 'knowledge_moved', 'insight');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "notification_source" DEFAULT 'librarian' NOT NULL,
	"type" "notification_type" NOT NULL,
	"message" text NOT NULL,
	"document_path" text,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");