DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connections' AND column_name = 'is_starred') THEN
        ALTER TABLE "connections" ADD COLUMN "is_starred" boolean DEFAULT false NOT NULL;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connections' AND column_name = 'starred_at') THEN
        ALTER TABLE "connections" ADD COLUMN "starred_at" timestamp with time zone;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connections_user_starred_idx" ON "connections" USING btree ("user_id","is_starred","last_activity_at");
