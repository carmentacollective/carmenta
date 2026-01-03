ALTER TABLE "scheduled_jobs" ADD COLUMN "seq_id" serial NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_seq_id_unique" UNIQUE("seq_id");