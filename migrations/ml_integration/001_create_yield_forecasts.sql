-- =====================================================
-- Migration: 001_create_yield_forecasts.sql
-- Description: Create yield_forecasts table for storing ML yield predictions
-- Dependencies: users, plant_data tables must exist
-- =====================================================

-- Create yield_forecasts table
CREATE TABLE IF NOT EXISTS yield_forecasts (
    forecast_id BIGSERIAL PRIMARY KEY,
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plant_id BIGINT REFERENCES plant_data(plant_id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL DEFAULT CURRENT_DATE,
    forecast_years INTEGER NOT NULL DEFAULT 5,
    
    -- Input parameters for the forecast
    plant_age_months INTEGER NOT NULL,
    farm_area_ha NUMERIC(10, 2) NOT NULL,
    elevation_masl NUMERIC(8, 2),
    monthly_temp_avg_c NUMERIC(5, 2),
    monthly_rainfall_mm NUMERIC(6, 2),
    soil_pH NUMERIC(4, 2),
    soil_moisture_pct NUMERIC(5, 2),
    fertilization_type VARCHAR(20),
    fertilization_frequency INTEGER,
    pest_management_frequency INTEGER,
    
    -- Forecast results stored as JSONB for flexibility
    forecast_data JSONB NOT NULL,  -- Yearly forecast breakdown
    summary_metrics JSONB NOT NULL,  -- Total yield, averages, etc.
    suitability_scores JSONB,  -- Climate, soil, quality indices
    
    -- Metadata and timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Verification system fields (consistent with other tables)
    verification_status VARCHAR(20) DEFAULT 'draft' CHECK (verification_status IN ('draft', 'pending', 'approved', 'rejected')),
    admin_notes TEXT,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_yield_forecasts_farmer ON yield_forecasts(farmer_id);
CREATE INDEX IF NOT EXISTS idx_yield_forecasts_plant ON yield_forecasts(plant_id);
CREATE INDEX IF NOT EXISTS idx_yield_forecasts_date ON yield_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_yield_forecasts_verification ON yield_forecasts(verification_status);
CREATE INDEX IF NOT EXISTS idx_yield_forecasts_created_at ON yield_forecasts(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE yield_forecasts IS 'Stores ML-generated yield forecasts for coffee farms';
COMMENT ON COLUMN yield_forecasts.forecast_data IS 'JSONB containing yearly forecast breakdown with yield and grade probabilities';
COMMENT ON COLUMN yield_forecasts.summary_metrics IS 'JSONB containing aggregated metrics (total yield, averages, etc.)';
COMMENT ON COLUMN yield_forecasts.suitability_scores IS 'JSONB containing climate, soil, and quality suitability scores';

-- Enable Row Level Security
ALTER TABLE yield_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Farmers can view their own forecasts
CREATE POLICY IF NOT EXISTS "Farmers can view their own forecasts"
ON yield_forecasts FOR SELECT
USING (auth.uid() = farmer_id);

-- RLS Policy: Farmers can insert their own forecasts
CREATE POLICY IF NOT EXISTS "Farmers can insert their own forecasts"
ON yield_forecasts FOR INSERT
WITH CHECK (auth.uid() = farmer_id);

-- RLS Policy: Farmers can update their own forecasts (only draft/pending)
CREATE POLICY IF NOT EXISTS "Farmers can update their own forecasts"
ON yield_forecasts FOR UPDATE
USING (auth.uid() = farmer_id)
WITH CHECK (
    auth.uid() = farmer_id AND
    verification_status IN ('draft', 'pending')
);

-- RLS Policy: Admins can view all forecasts
CREATE POLICY IF NOT EXISTS "Admins can view all forecasts"
ON yield_forecasts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- RLS Policy: Admins can update all forecasts (for verification)
CREATE POLICY IF NOT EXISTS "Admins can update all forecasts"
ON yield_forecasts FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- RLS Policy: Admins can delete forecasts (if needed)
CREATE POLICY IF NOT EXISTS "Admins can delete forecasts"
ON yield_forecasts FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

