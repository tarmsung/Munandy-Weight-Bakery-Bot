-- Create vehicle_expenses table
CREATE TABLE IF NOT EXISTS vehicle_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_registration TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    description TEXT NOT NULL,
    branch TEXT,
    expense_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_message TEXT,
    reporter_jid TEXT
);

-- ============================================================
-- GRANT statements required by Supabase Data API (May 30, 2026)
-- Without these, supabase-js / PostgREST will return 42501 errors
-- ============================================================

-- Allow anon role read-only access (for public-facing queries if any)
GRANT SELECT ON public.vehicle_expenses TO anon;

-- Allow authenticated role full CRUD
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_expenses TO authenticated;

-- Allow service_role full CRUD (used by your bot's service key)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_expenses TO service_role;

-- Enable Row Level Security
ALTER TABLE vehicle_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable insert for authenticated users only" ON vehicle_expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable read access for all users" ON vehicle_expenses FOR SELECT USING (true);

-- ============================================================
-- NOTE: route_reports table also needs the same GRANTs.
-- Run the following against your route_reports table too:
-- ============================================================
-- GRANT SELECT ON public.route_reports TO anon;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_reports TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_reports TO service_role;
