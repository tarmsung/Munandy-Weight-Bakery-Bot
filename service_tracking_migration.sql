-- =========================================================
-- Service Tracking — Database Migration
-- =========================================================

-- 1. Create Vehicle Service table
-- Tracks accumulated km since the last service.
CREATE TABLE IF NOT EXISTS vehicle_service (
    id                SERIAL PRIMARY KEY,
    registration      TEXT NOT NULL REFERENCES vehicles(registration) ON DELETE CASCADE,
    km_since_service  NUMERIC DEFAULT 0,
    last_service_date DATE,
    updated_at        TIMESTAMP DEFAULT NOW(),
    UNIQUE(registration)
);

-- 2. Create Service Alerts table
-- Tracks which vehicles have received a service alert today.
CREATE TABLE IF NOT EXISTS service_alerts (
    id                SERIAL PRIMARY KEY,
    registration      TEXT NOT NULL REFERENCES vehicles(registration) ON DELETE CASCADE,
    alert_date        DATE NOT NULL,
    status            VARCHAR(20) NOT NULL,
    UNIQUE(registration, alert_date)
);

-- Seed existing vehicles into the service table
INSERT INTO vehicle_service (registration)
SELECT registration FROM vehicles
WHERE is_active = true
ON CONFLICT (registration) DO NOTHING;
