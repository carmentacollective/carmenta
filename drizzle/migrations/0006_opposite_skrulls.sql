CREATE TYPE "public"."document_source_type" AS ENUM('manual', 'seed', 'conversation_extraction', 'conversation_decision', 'conversation_commitment', 'uploaded_pdf', 'uploaded_image', 'uploaded_audio', 'uploaded_document', 'uploaded_text', 'integration_limitless', 'integration_fireflies', 'integration_gmail', 'integration_slack', 'integration_notion');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"path" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"source_type" "document_source_type" DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_user_path_unique_idx" ON "documents" USING btree ("user_id","path");--> statement-breakpoint
CREATE INDEX "documents_tags_idx" ON "documents" USING btree ("tags");