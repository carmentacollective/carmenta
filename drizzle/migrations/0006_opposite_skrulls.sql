-- Create document_source_type enum if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_source_type') THEN
        CREATE TYPE "public"."document_source_type" AS ENUM('manual', 'seed', 'conversation_extraction', 'conversation_decision', 'conversation_commitment', 'uploaded_pdf', 'uploaded_image', 'uploaded_audio', 'uploaded_document', 'uploaded_text', 'integration_limitless', 'integration_fireflies', 'integration_gmail', 'integration_slack', 'integration_notion');
    END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
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
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'documents_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_user_path_unique_idx" ON "documents" USING btree ("user_id","path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_tags_idx" ON "documents" USING btree ("tags");
