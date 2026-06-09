-- 1. Create settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 2. Insert default iced/creamed deduction weight
INSERT INTO settings (key, value) VALUES ('finish_deduction_weight', '20') ON CONFLICT (key) DO NOTHING;

-- 3. Grants for settings table
GRANT SELECT ON public.settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO service_role;
