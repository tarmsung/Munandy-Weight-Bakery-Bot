-- ============================================================
-- Driver Job ID Migration
-- Run this in your Supabase project → SQL Editor
-- ============================================================

-- 1. Add the new job_id column
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS job_id TEXT;

-- 2. Populate job_id with 2-digit numbers starting from 10
DO $$
DECLARE
    rec RECORD;
    counter INT := 10;
BEGIN
    FOR rec IN SELECT id FROM drivers ORDER BY name LOOP
        UPDATE drivers SET job_id = counter::TEXT WHERE id = rec.id;
        counter := counter + 1;
    END LOOP;
END $$;

-- 3. Enforce uniqueness on the job_id column
ALTER TABLE drivers ADD CONSTRAINT drivers_job_id_key UNIQUE (job_id);
