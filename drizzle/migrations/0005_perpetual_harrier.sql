-- Make column type change idempotent by checking current type
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'connections'
        AND column_name = 'concierge_temperature'
        AND data_type = 'real'
    ) THEN
        ALTER TABLE "connections" ALTER COLUMN "concierge_temperature" SET DATA TYPE numeric(3, 2);
    END IF;
END $$;
