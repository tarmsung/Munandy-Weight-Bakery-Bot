-- =========================================================
-- Fleet Daily Report — Database Migration
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/kviqyqmbbemsagstefmo/sql
-- =========================================================

-- 1. Create Vehicle Maintenance table
-- Tracks when service or suspension checks are due.
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
    id             SERIAL PRIMARY KEY,
    registration   TEXT NOT NULL REFERENCES vehicles(registration) ON DELETE CASCADE,
    service_due    DATE,
    suspension_due DATE,
    last_updated   TIMESTAMP DEFAULT NOW()
);

-- 2. Create Vehicle Insurance table
-- Tracks when insurance policies expire.
CREATE TABLE IF NOT EXISTS vehicle_insurance (
    id             SERIAL PRIMARY KEY,
    registration   TEXT NOT NULL REFERENCES vehicles(registration) ON DELETE CASCADE,
    insurance_due  DATE NOT NULL,
    policy_number  VARCHAR(100),
    last_updated   TIMESTAMP DEFAULT NOW()
);

-- 3. Create Daily Reports table
-- Stores snapshots of the daily fleet status to prevent duplicate sending.
CREATE TABLE IF NOT EXISTS daily_reports (
    id             SERIAL PRIMARY KEY,
    date           DATE UNIQUE NOT NULL,
    payload        JSONB NOT NULL,
    sent           BOOLEAN DEFAULT false,
    sent_at        TIMESTAMP,
    created_at     TIMESTAMP DEFAULT NOW()
);

-- Indices for faster lookups during report generation
CREATE INDEX IF NOT EXISTS idx_maintenance_service_due ON vehicle_maintenance(service_due);
CREATE INDEX IF NOT EXISTS idx_maintenance_suspension_due ON vehicle_maintenance(suspension_due);
CREATE INDEX IF NOT EXISTS idx_insurance_due ON vehicle_insurance(insurance_due);
