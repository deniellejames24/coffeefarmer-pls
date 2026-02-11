-- =====================================================
-- Migration: 002_create_quality_predictions.sql
-- Description: Create quality_predictions table for storing ML quality grade predictions
-- Dependencies: users, plant_data, harvest_data tables must exist
-- =====================================================

-- Create quality_predictions table
CREATE TABLE IF NOT EXISTS quality_predictions (
    prediction_id BIGSERIAL PRIMARY KEY,
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plant_id BIGINT REFERENCES plant_data(plant_id) ON DELETE CASCADE,
    harvest_id BIGINT REFERENCES harvest_data(harvest_id) ON DELETE SET NULL,
    prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Input parameters used for prediction
    quality_score NUMERIC(5, 2),
    climate_suitability NUMERIC(4, 3),
    soil_suitability NUMERIC(4, 3),
    fertilization_factor NUMERIC(4, 3),
    pest_factor NUMERIC(4, 3),
    
    -- Prediction results (probabilities must sum to ~1.0)
    fine_probability NUMERIC(4, 3) NOT NULL CHECK (fine_probability >= 0 AND fine_probability <= 1),
    premium_probability NUMERIC(4, 3) NOT NULL CHECK (premium_probability >= 0 AND premium_probability <= 1),
    commercial_probability NUMERIC(4, 3) NOT NULL CHECK (commercial_probability >= 0 AND commercial_probability <= 1),
    
    -- Metadata and timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Verification system fields
    verification_status VARCHAR(20) DEFAULT 'draft' CHECK (verification_status IN ('draft', 'pending', 'approved', 'rejected')),
    admin_notes TEXT,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quality_predictions_farmer ON quality_predictions(farmer_id);
CREATE INDEX IF NOT EXISTS idx_quality_predictions_plant ON quality_predictions(plant_id);
CREATE INDEX IF NOT EXISTS idx_quality_predictions_harvest ON quality_predictions(harvest_id);
CREATE INDEX IF NOT EXISTS idx_quality_predictions_date ON quality_predictions(prediction_date);
CREATE INDEX IF NOT EXISTS idx_quality_predictions_verification ON quality_predictions(verification_status);
CREATE INDEX IF NOT EXISTS idx_quality_predictions_created_at ON quality_predictions(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE quality_predictions IS 'Stores ML-generated quality grade distribution predictions';
COMMENT ON COLUMN quality_predictions.fine_probability IS 'Probability (0-1) of Fine Robusta grade';
COMMENT ON COLUMN quality_predictions.premium_probability IS 'Probability (0-1) of Premium Robusta grade';
COMMENT ON COLUMN quality_predictions.commercial_probability IS 'Probability (0-1) of Commercial grade';

-- Enable Row Level Security
ALTER TABLE quality_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Farmers can view their own predictions
CREATE POLICY IF NOT EXISTS "Farmers can view their own predictions"
ON quality_predictions FOR SELECT
USING (auth.uid() = farmer_id);

-- RLS Policy: Farmers can insert their own predictions
CREATE POLICY IF NOT EXISTS "Farmers can insert their own predictions"
ON quality_predictions FOR INSERT
WITH CHECK (auth.uid() = farmer_id);

-- RLS Policy: Farmers can update their own predictions (only draft/pending)
CREATE POLICY IF NOT EXISTS "Farmers can update their own predictions"
ON quality_predictions FOR UPDATE
USING (auth.uid() = farmer_id)
WITH CHECK (
    auth.uid() = farmer_id AND
    verification_status IN ('draft', 'pending')
);

-- RLS Policy: Admins can view all predictions
CREATE POLICY IF NOT EXISTS "Admins can view all predictions"
ON quality_predictions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- RLS Policy: Admins can update all predictions (for verification)
CREATE POLICY IF NOT EXISTS "Admins can update all predictions"
ON quality_predictions FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- RLS Policy: Admins can delete predictions (if needed)
CREATE POLICY IF NOT EXISTS "Admins can delete predictions"
ON quality_predictions FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

