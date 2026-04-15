-- Create vehicle_expenses table
CREATE TABLE vehicle_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_registration TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'USD',
    description TEXT NOT NULL,
    expense_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_message TEXT,
    reporter_jid TEXT
);

-- Give the anon/authenticated roles access (adjust according to your security posture)
ALTER TABLE vehicle_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for authenticated users only" ON vehicle_expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable read access for all users" ON vehicle_expenses FOR SELECT USING (true);
