-- Add observability columns to job_runs for execution tracing and debugging

ALTER TABLE job_runs ADD COLUMN execution_trace JSONB;
ALTER TABLE job_runs ADD COLUMN error_details JSONB;
ALTER TABLE job_runs ADD COLUMN token_usage JSONB;
ALTER TABLE job_runs ADD COLUMN model_id TEXT;
ALTER TABLE job_runs ADD COLUMN duration_ms INTEGER;
ALTER TABLE job_runs ADD COLUMN sentry_trace_id TEXT;
