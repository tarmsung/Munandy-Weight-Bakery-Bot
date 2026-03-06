-- ============================================================
-- Munandy Bakery WhatsApp Bot — Supabase Setup SQL
-- Run this once in your Supabase project → SQL Editor
-- ============================================================

-- 1. Products table
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  product_name  TEXT    NOT NULL,
  target_weight NUMERIC NOT NULL,   -- midpoint of the acceptable range
  min_weight    NUMERIC NOT NULL,
  max_weight    NUMERIC NOT NULL
);

-- 2. Seed products (Standard Finished Product chart)
--    target_weight = midpoint of min–max range
INSERT INTO products (product_name, target_weight, min_weight, max_weight) VALUES
  ('Rolls (4)',         338, 330, 345),
  ('Hot Dogs (4)',      338, 330, 345),
  ('Plain Buns (4)',    183, 175, 190),
  ('Fatfree',           160, 155, 165),
  ('Danish',            160, 155, 165),
  ('Cream Doughnut',    170, 165, 175),
  ('Ring Doughnut',     170, 165, 175),
  ('Twist Doughnut',    170, 165, 175),
  ('Mighty Glaze',      130, 125, 135),
  ('Lemon Scandal',     185, 180, 190),
  ('Scone',             105, 100, 110),
  ('Rock Bun',          200, 195, 205),
  ('Joy Crunch',        105, 100, 110)
ON CONFLICT DO NOTHING;

-- 3. Weight records table
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
