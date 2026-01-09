-- Drop the unused integrations column from scheduled_jobs
-- This column was never actually used to filter tools - agents always had access to all connected tools
ALTER TABLE "scheduled_jobs" DROP COLUMN IF EXISTS "integrations";
