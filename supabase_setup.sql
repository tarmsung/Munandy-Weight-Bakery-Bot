-- ============================================================
-- Munandy Bakery WhatsApp Bot — Supabase Setup SQL
-- Run this once in your Supabase project → SQL Editor
-- ============================================================

-- 1. Products table
--    The acceptable range (min_weight to max_weight) IS the target.
--    Average below min = Underweight | above max = Overweight | within range = Optimal
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  product_name  TEXT    NOT NULL,
  min_weight    NUMERIC NOT NULL,
  max_weight    NUMERIC NOT NULL
);

-- 2. Seed products (Standard Finished Product chart)
INSERT INTO products (product_name, min_weight, max_weight) VALUES
  ('Rolls (4)',         330, 345),
  ('Hot Dogs (4)',      330, 345),
  ('Plain Buns (4)',    175, 190),
  ('Fatfree',           155, 165),
  ('Danish',            155, 165),
  ('Cream Doughnut',    165, 175),
  ('Ring Doughnut',     165, 175),
  ('Twist Doughnut',    165, 175),
  ('Mighty Glaze',      125, 135),
  ('Lemon Scandal',     180, 190),
  ('Scone',             100, 110),
  ('Rock Bun',          195, 205),
  ('Joy Crunch',        100, 110)
ON CONFLICT DO NOTHING;

-- 3. Weight records table
--    variance: distance outside the range
--              positive (+) = how far above max_weight
--              negative (-) = how far below min_weight
--              zero    (0)  = within range (Optimal)
CREATE TABLE IF NOT EXISTS weight_records (
  id          BIGSERIAL PRIMARY KEY,
  product_id  INT       NOT NULL REFERENCES products(id),
  sample1     NUMERIC   NOT NULL,
  sample2     NUMERIC   NOT NULL,
  sample3     NUMERIC   NOT NULL,
  sample4     NUMERIC   NOT NULL,
  average     NUMERIC   NOT NULL,
  quantity    INT,
  status      TEXT      NOT NULL CHECK (status IN ('Optimal', 'Overweight', 'Underweight')),
  variance    NUMERIC   NOT NULL,
  recorded_by TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
