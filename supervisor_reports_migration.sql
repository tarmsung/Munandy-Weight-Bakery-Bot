-- 1. Create supervisor_reports table
CREATE TABLE IF NOT EXISTS supervisor_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    supervisor_number TEXT NOT NULL,
    branch TEXT NOT NULL,
    
    shop_score INTEGER CHECK (shop_score BETWEEN 1 AND 5),
    shop_comment TEXT,
    
    delivery_score INTEGER CHECK (delivery_score BETWEEN 1 AND 5),
    delivery_comment TEXT,
    
    procurement_score INTEGER CHECK (procurement_score BETWEEN 1 AND 5),
    procurement_comment TEXT,
    
    production_score INTEGER CHECK (production_score BETWEEN 1 AND 5),
    production_comment TEXT,
    
    workers_score INTEGER CHECK (workers_score BETWEEN 1 AND 5),
    workers_comment TEXT,
    
    cashing_office_score INTEGER CHECK (cashing_office_score BETWEEN 1 AND 5),
    cashing_office_comment TEXT,
    
    security_score INTEGER CHECK (security_score BETWEEN 1 AND 5),
    security_comment TEXT,
    
    packing_score INTEGER CHECK (packing_score BETWEEN 1 AND 5),
    packing_comment TEXT,
    
    hygiene_score INTEGER CHECK (hygiene_score BETWEEN 1 AND 5),
    hygiene_comment TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Grants for supervisor_reports
GRANT SELECT ON public.supervisor_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisor_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisor_reports TO service_role;
