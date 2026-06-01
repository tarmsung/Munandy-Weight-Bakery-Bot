-- ============================================================
-- Munandy Weight-Bot — Supabase Data API GRANT Migration
-- Required by Supabase change effective May 30 / Oct 30, 2026
-- Run this ONCE in: Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/kviqyqmbbemsagstefmo/sql
-- ============================================================
-- This grants access to ALL 16 tables used by the bot.
-- Without these, supabase-js / PostgREST returns 42501 errors.
-- ============================================================

-- ── 1. products ─────────────────────────────────────────────
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO service_role;

-- ── 2. weight_records ───────────────────────────────────────
GRANT SELECT ON public.weight_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_records TO service_role;

-- ── 3. supervisors ──────────────────────────────────────────
GRANT SELECT ON public.supervisors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisors TO service_role;

-- ── 4. vehicles ─────────────────────────────────────────────
GRANT SELECT ON public.vehicles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO service_role;

-- ── 5. drivers ──────────────────────────────────────────────
GRANT SELECT ON public.drivers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO service_role;

-- ── 6. inspection_reports ───────────────────────────────────
GRANT SELECT ON public.inspection_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_reports TO service_role;

-- ── 7. route_reporters ──────────────────────────────────────
GRANT SELECT ON public.route_reporters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_reporters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_reporters TO service_role;

-- ── 8. routes ───────────────────────────────────────────────
GRANT SELECT ON public.routes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO service_role;

-- ── 9. route_reports ────────────────────────────────────────
GRANT SELECT ON public.route_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_reports TO service_role;

-- ── 10. vehicle_expenses ─────────────────────────────────────
GRANT SELECT ON public.vehicle_expenses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_expenses TO service_role;

-- ── 11. vehicle_service ──────────────────────────────────────
GRANT SELECT ON public.vehicle_service TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_service TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_service TO service_role;

-- ── 12. service_alerts ───────────────────────────────────────
GRANT SELECT ON public.service_alerts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_alerts TO service_role;

-- ── 13. service_logs ─────────────────────────────────────────
GRANT SELECT ON public.service_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_logs TO service_role;

-- ── 14. vehicle_maintenance ──────────────────────────────────
GRANT SELECT ON public.vehicle_maintenance TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenance TO service_role;

-- ── 15. vehicle_insurance ────────────────────────────────────
GRANT SELECT ON public.vehicle_insurance TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_insurance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_insurance TO service_role;

-- ── 16. daily_reports ────────────────────────────────────────
GRANT SELECT ON public.daily_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO service_role;

-- ── 17. daily_flour_logs ─────────────────────────────────────
GRANT SELECT ON public.daily_flour_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_flour_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_flour_logs TO service_role;

-- ============================================================
-- ✅ Done. All 17 tables now have explicit grants.
-- ============================================================
