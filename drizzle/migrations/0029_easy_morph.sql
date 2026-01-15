DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'voice'
        AND enumtypid = 'public.extraction_category'::regtype
    ) THEN
        ALTER TYPE "public"."extraction_category" ADD VALUE 'voice';
    END IF;
END $$;
