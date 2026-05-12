-- =========================================================
-- Migration: Create service_logs table
-- Purpose:   Records odometer readings when a service is
--            marked as completed by an admin.
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/<your-project>/sql
-- =========================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS service_logs (
    id               SERIAL PRIMARY KEY,
    registration     TEXT NOT NULL REFERENCES vehicles(registration) ON DELETE CASCADE,
    odometer_reading NUMERIC NOT NULL,
    logged_at        TIMESTAMP DEFAULT NOW()
);

-- 2. Disable Row Level Security so the anon/service key can insert
--    (The bot uses the anon key — RLS would block inserts otherwise)
ALTER TABLE service_logs DISABLE ROW LEVEL SECURITY;
