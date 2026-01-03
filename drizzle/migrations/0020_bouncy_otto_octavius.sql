ALTER TABLE "job_runs" ADD COLUMN "execution_trace" jsonb;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "error_details" jsonb;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "token_usage" jsonb;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "model_id" text;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "job_runs" ADD COLUMN "sentry_trace_id" text;