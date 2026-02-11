-- =====================================================
-- Migration: 003_create_ml_recommendations.sql
-- Description: Create ml_recommendations table for storing personalized farming recommendations
-- Dependencies: users, plant_data tables must exist
-- =====================================================

-- Create ml_recommendations table
CREATE TABLE IF NOT EXISTS ml_recommendations (
    recommendation_id BIGSERIAL PRIMARY KEY,
    farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plant_id BIGINT REFERENCES plant_data(plant_id) ON DELETE CASCADE,
    recommendation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Recommendation data stored as structured JSONB
    recommendations JSONB NOT NULL,  -- {critical: [], warnings: [], suggestions: [], maintenance: []}
    
    -- Input parameters used (for traceability and debugging)
    input_parameters JSONB,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'implemented')),
    priority VARCHAR(10) CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    category VARCHAR(50),  -- fertilization, pest_management, soil, climate, etc.
    
    -- Metadata and timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dismissed_at TIMESTAMPTZ,
    implemented_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_farmer ON ml_recommendations(farmer_id);
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_plant ON ml_recommendations(plant_id);
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_status ON ml_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_priority ON ml_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_category ON ml_recommendations(category);
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_date ON ml_recommendations(recommendation_date);
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_created_at ON ml_recommendations(created_at DESC);

-- Create GIN index for JSONB recommendations column (for efficient JSON queries)
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_recommendations_gin ON ml_recommendations USING GIN (recommendations);

-- Add comments for documentation
COMMENT ON TABLE ml_recommendations IS 'Stores ML-generated personalized farming recommendations';
COMMENT ON COLUMN ml_recommendations.recommendations IS 'JSONB structure: {critical: [], warnings: [], suggestions: [], maintenance: []}';
COMMENT ON COLUMN ml_recommendations.input_parameters IS 'JSONB containing input parameters used to generate recommendations (for traceability)';
COMMENT ON COLUMN ml_recommendations.status IS 'Status: active (visible), dismissed (user dismissed), implemented (user acted on)';
COMMENT ON COLUMN ml_recommendations.priority IS 'Priority level: critical, high, medium, low';
COMMENT ON COLUMN ml_recommendations.category IS 'Category: fertilization, pest_management, soil, climate, irrigation, etc.';

-- Enable Row Level Security
ALTER TABLE ml_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Farmers can view their own recommendations
CREATE POLICY IF NOT EXISTS "Farmers can view their own recommendations"
ON ml_recommendations FOR SELECT
USING (auth.uid() = farmer_id);

-- RLS Policy: Farmers can insert their own recommendations
CREATE POLICY IF NOT EXISTS "Farmers can insert their own recommendations"
ON ml_recommendations FOR INSERT
WITH CHECK (auth.uid() = farmer_id);

-- RLS Policy: Farmers can update their own recommendations (status changes)
CREATE POLICY IF NOT EXISTS "Farmers can update their own recommendations"
ON ml_recommendations FOR UPDATE
USING (auth.uid() = farmer_id)
WITH CHECK (auth.uid() = farmer_id);

-- RLS Policy: Admins can view all recommendations
CREATE POLICY IF NOT EXISTS "Admins can view all recommendations"
ON ml_recommendations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- RLS Policy: Admins can update all recommendations
CREATE POLICY IF NOT EXISTS "Admins can update all recommendations"
ON ml_recommendations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- RLS Policy: Admins can delete recommendations (if needed)
CREATE POLICY IF NOT EXISTS "Admins can delete recommendations"
ON ml_recommendations FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ml_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_ml_recommendations_updated_at
BEFORE UPDATE ON ml_recommendations
FOR EACH ROW
EXECUTE FUNCTION update_ml_recommendations_updated_at();

