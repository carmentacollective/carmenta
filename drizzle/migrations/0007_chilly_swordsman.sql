ALTER TABLE "connections" ADD COLUMN "is_starred" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN "starred_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "connections_user_starred_idx" ON "connections" USING btree ("user_id","is_starred","last_activity_at");