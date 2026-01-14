CREATE TYPE "public"."model_tier" AS ENUM('quick', 'balanced', 'deep');--> statement-breakpoint
CREATE TYPE "public"."reasoning_level" AS ENUM('none', 'low', 'medium', 'high');--> statement-breakpoint
ALTER TYPE "public"."job_run_status" ADD VALUE 'partial' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."job_run_status" ADD VALUE 'blocked';--> statement-breakpoint
ALTER TABLE "scheduled_jobs" DROP COLUMN "memory";--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "agent_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "user_config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "model_tier" "model_tier" DEFAULT 'balanced' NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "reasoning_level" "reasoning_level" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD COLUMN "temperature" real;
