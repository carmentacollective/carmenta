DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connections' AND column_name = 'concierge_model_id') THEN
        ALTER TABLE "connections" ADD COLUMN "concierge_model_id" varchar(255);
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connections' AND column_name = 'concierge_temperature') THEN
        ALTER TABLE "connections" ADD COLUMN "concierge_temperature" real;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connections' AND column_name = 'concierge_explanation') THEN
        ALTER TABLE "connections" ADD COLUMN "concierge_explanation" text;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connections' AND column_name = 'concierge_reasoning') THEN
        ALTER TABLE "connections" ADD COLUMN "concierge_reasoning" jsonb;
    END IF;
END $$;
