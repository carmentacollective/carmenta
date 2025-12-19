-- Make user_id nullable if it isn't already
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'user_id' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "documents" ALTER COLUMN "user_id" DROP NOT NULL;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'description') THEN
        ALTER TABLE "documents" ADD COLUMN "description" text;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'prompt_label') THEN
        ALTER TABLE "documents" ADD COLUMN "prompt_label" varchar(50);
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'prompt_hint') THEN
        ALTER TABLE "documents" ADD COLUMN "prompt_hint" text;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'prompt_order') THEN
        ALTER TABLE "documents" ADD COLUMN "prompt_order" integer DEFAULT 0;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'always_include') THEN
        ALTER TABLE "documents" ADD COLUMN "always_include" boolean DEFAULT false NOT NULL;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'searchable') THEN
        ALTER TABLE "documents" ADD COLUMN "searchable" boolean DEFAULT false NOT NULL;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'editable') THEN
        ALTER TABLE "documents" ADD COLUMN "editable" boolean DEFAULT true NOT NULL;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_always_include_idx" ON "documents" USING btree ("user_id","always_include");
