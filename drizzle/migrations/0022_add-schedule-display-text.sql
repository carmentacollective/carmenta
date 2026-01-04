-- Add schedule display text for human-readable schedule display
-- This stores the human-friendly version of the cron expression (e.g., "Weekdays at 9am CT")
ALTER TABLE "scheduled_jobs" ADD COLUMN "schedule_display_text" text;
