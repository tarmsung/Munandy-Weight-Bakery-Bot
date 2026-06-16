-- ============================================================
-- Message Deletion & Job Cards Migration
-- Run this in your Supabase project → SQL Editor
-- ============================================================

-- 1. Create job_cards table
CREATE TABLE IF NOT EXISTS job_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_registration TEXT NOT NULL,
    job_date TEXT,
    description TEXT NOT NULL,
    fuel TEXT,
    price TEXT,
    time_out TEXT,
    time_in TEXT,
    driver_job_id TEXT NOT NULL,
    reporter_jid TEXT,
    message_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant privileges for job_cards
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_cards TO service_role;

-- 2. Add message_id to inspection_reports
ALTER TABLE inspection_reports ADD COLUMN IF NOT EXISTS message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_inspection_reports_message_id ON inspection_reports(message_id);

-- 3. Add message_id to route_reports
ALTER TABLE route_reports ADD COLUMN IF NOT EXISTS message_id TEXT;
CREATE INDEX IF NOT EXISTS idx_route_reports_message_id ON route_reports(message_id);
