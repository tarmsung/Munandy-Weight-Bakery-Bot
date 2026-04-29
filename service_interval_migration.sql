-- ============================================================
-- Migration: Add service_due_at_km to vehicle_service table
-- Purpose:   Supports carry-over logic when a vehicle is
--            serviced before the 5,000 km interval. The remaining
--            km are credited to the next service window.
-- Run this in your Supabase SQL editor.
-- ============================================================


-- Backfill existing rows: set to 5000 (standard interval)
UPDATE vehicle_service
SET service_due_at_km = 5000
WHERE service_due_at_km IS NULL OR service_due_at_km = 0;
