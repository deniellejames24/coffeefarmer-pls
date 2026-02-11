-- =====================================================
-- Migration: 004_create_ml_models.sql
-- Description: Create ml_models table for tracking ML model versions and metadata
-- Dependencies: users table must exist
-- Note: This table is admin-only, no RLS needed (or RLS allows only admins)
-- =====================================================

-- Create ml_models table
CREATE TABLE IF NOT EXISTS ml_models (
    model_id BIGSERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type VARCHAR(50) NOT NULL,  -- classification, regression, etc.
    version VARCHAR(20) NOT NULL,
    
    -- Model metadata
    training_date TIMESTAMPTZ NOT NULL,
    training_data_hash VARCHAR(64),  -- SHA256 hash of training data for reproducibility
    feature_columns TEXT[],  -- Array of feature column names used in training
    hyperparameters JSONB,  -- Model hyperparameters stored as JSONB
    
    -- Performance metrics
    accuracy NUMERIC(5, 4),  -- For classification models (0-1)
    r2_score NUMERIC(5, 4),  -- For regression models (can be negative)
    rmse NUMERIC(10, 4),  -- Root Mean Squared Error (for regression)
    mae NUMERIC(10, 4),  -- Mean Absolute Error (for regression)
    
    -- Model file reference
    model_file_path TEXT,  -- Path to .pkl file (local filesystem or S3/cloud storage)
    model_file_size_bytes BIGINT,  -- Size of model file in bytes
    
    -- Status flags
    is_active BOOLEAN DEFAULT FALSE,  -- Currently active model
    is_production BOOLEAN DEFAULT FALSE,  -- Deployed to production
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    notes TEXT,  -- Additional notes about the model
    
    -- Constraints
    CONSTRAINT valid_accuracy CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 1)),
    CONSTRAINT valid_r2 CHECK (r2_score IS NULL OR r2_score <= 1),
    CONSTRAINT valid_metrics CHECK (
        (model_type = 'classification' AND accuracy IS NOT NULL) OR
        (model_type = 'regression' AND (r2_score IS NOT NULL OR rmse IS NOT NULL))
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ml_models_name ON ml_models(model_name);
CREATE INDEX IF NOT EXISTS idx_ml_models_type ON ml_models(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_models_active ON ml_models(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ml_models_production ON ml_models(is_production) WHERE is_production = TRUE;
CREATE INDEX IF NOT EXISTS idx_ml_models_training_date ON ml_models(training_date DESC);
CREATE INDEX IF NOT EXISTS idx_ml_models_version ON ml_models(model_name, version);

-- Add comments for documentation
COMMENT ON TABLE ml_models IS 'Tracks ML model versions, metadata, and performance metrics';
COMMENT ON COLUMN ml_models.model_name IS 'Unique name identifier (e.g., grade_classification_best, defect_prediction_best)';
COMMENT ON COLUMN ml_models.model_type IS 'Type of model: classification, regression, etc.';
COMMENT ON COLUMN ml_models.training_data_hash IS 'SHA256 hash of training dataset for reproducibility';
COMMENT ON COLUMN ml_models.feature_columns IS 'Array of feature column names used during training';
COMMENT ON COLUMN ml_models.hyperparameters IS 'JSONB containing model hyperparameters';
COMMENT ON COLUMN ml_models.model_file_path IS 'Path to saved model file (.pkl) - can be local or cloud storage';
COMMENT ON COLUMN ml_models.is_active IS 'Whether this model is currently active (only one per model_name should be active)';
COMMENT ON COLUMN ml_models.is_production IS 'Whether this model is deployed to production';

-- Enable Row Level Security (admin-only access)
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view models
CREATE POLICY IF NOT EXISTS "Only admins can view models"
ON ml_models FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- RLS Policy: Only admins can insert models
CREATE POLICY IF NOT EXISTS "Only admins can insert models"
ON ml_models FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- RLS Policy: Only admins can update models
CREATE POLICY IF NOT EXISTS "Only admins can update models"
ON ml_models FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- RLS Policy: Only admins can delete models
CREATE POLICY IF NOT EXISTS "Only admins can delete models"
ON ml_models FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Create unique constraint to ensure only one active model per model_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_models_unique_active 
ON ml_models(model_name) 
WHERE is_active = TRUE;

