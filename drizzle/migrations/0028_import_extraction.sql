DO $$ BEGIN
    CREATE TYPE "public"."extraction_category" AS ENUM('identity', 'preference', 'person', 'project', 'decision', 'expertise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."extraction_job_status" AS ENUM('queued', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'approved', 'rejected', 'edited');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extraction_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "extraction_job_status" DEFAULT 'queued' NOT NULL,
	"total_conversations" integer NOT NULL,
	"processed_conversations" integer DEFAULT 0 NOT NULL,
	"extracted_count" integer DEFAULT 0 NOT NULL,
	"connection_ids" integer[],
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extraction_processed_connections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "extraction_processed_connections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"connection_id" integer NOT NULL,
	"job_id" uuid,
	"extraction_count" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pending_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" integer NOT NULL,
	"category" "extraction_category" NOT NULL,
	"content" text NOT NULL,
	"summary" text NOT NULL,
	"confidence" real NOT NULL,
	"source_message_id" text,
	"source_timestamp" timestamp with time zone,
	"conflicts_with" text[],
	"status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"edited_content" text,
	"reviewed_at" timestamp with time zone,
	"suggested_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "extraction_processed_connections" ADD CONSTRAINT "extraction_processed_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "extraction_processed_connections" ADD CONSTRAINT "extraction_processed_connections_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "extraction_processed_connections" ADD CONSTRAINT "extraction_processed_connections_job_id_extraction_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."extraction_jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "pending_extractions" ADD CONSTRAINT "pending_extractions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "pending_extractions" ADD CONSTRAINT "pending_extractions_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extraction_jobs_user_idx" ON "extraction_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "extraction_jobs_user_status_idx" ON "extraction_jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "extraction_processed_connection_idx" ON "extraction_processed_connections" USING btree ("user_id","connection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_extractions_user_idx" ON "pending_extractions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_extractions_user_status_idx" ON "pending_extractions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_extractions_connection_idx" ON "pending_extractions" USING btree ("connection_id");
