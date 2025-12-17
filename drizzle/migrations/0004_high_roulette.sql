ALTER TABLE "connections" ADD COLUMN "concierge_model_id" varchar(255);--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "concierge_temperature" real;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "concierge_explanation" text;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "concierge_reasoning" jsonb;