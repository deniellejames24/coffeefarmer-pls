-- =====================================================
-- Migration: 005_alter_existing_tables.sql
-- Description: Add ML-related columns to existing tables
-- Dependencies: plant_data, coffee_samples, harvest_data tables must exist
-- Note: All new columns are nullable to maintain backward compatibility
-- =====================================================

-- =====================================================
-- Enhancements to plant_data table
-- =====================================================

-- Add bean_screen_size_mm column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_data' 
        AND column_name = 'bean_screen_size_mm'
    ) THEN
        ALTER TABLE plant_data 
        ADD COLUMN bean_screen_size_mm NUMERIC(4, 2);
        
        COMMENT ON COLUMN plant_data.bean_screen_size_mm IS 'Average bean screen size in millimeters for this plant cluster';
    END IF;
END $$;

-- Add last_quality_prediction_date column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_data' 
        AND column_name = 'last_quality_prediction_date'
    ) THEN
        ALTER TABLE plant_data 
        ADD COLUMN last_quality_prediction_date DATE;
        
        COMMENT ON COLUMN plant_data.last_quality_prediction_date IS 'Date of the most recent quality prediction for this plant';
    END IF;
END $$;

-- Add last_yield_forecast_date column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plant_data' 
        AND column_name = 'last_yield_forecast_date'
    ) THEN
        ALTER TABLE plant_data 
        ADD COLUMN last_yield_forecast_date DATE;
        
        COMMENT ON COLUMN plant_data.last_yield_forecast_date IS 'Date of the most recent yield forecast for this plant';
    END IF;
END $$;

-- Create indexes for new columns (if they will be queried frequently)
CREATE INDEX IF NOT EXISTS idx_plant_data_bean_screen_size ON plant_data(bean_screen_size_mm) WHERE bean_screen_size_mm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plant_data_last_quality_pred ON plant_data(last_quality_prediction_date) WHERE last_quality_prediction_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plant_data_last_yield_forecast ON plant_data(last_yield_forecast_date) WHERE last_yield_forecast_date IS NOT NULL;

-- =====================================================
-- Enhancements to coffee_samples table
-- =====================================================

-- Add bean_screen_size_mm column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coffee_samples' 
        AND column_name = 'bean_screen_size_mm'
    ) THEN
        ALTER TABLE coffee_samples 
        ADD COLUMN bean_screen_size_mm NUMERIC(4, 2);
        
        COMMENT ON COLUMN coffee_samples.bean_screen_size_mm IS 'Bean screen size in millimeters';
    END IF;
END $$;

-- Add climate_suitability column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coffee_samples' 
        AND column_name = 'climate_suitability'
    ) THEN
        ALTER TABLE coffee_samples 
        ADD COLUMN climate_suitability NUMERIC(4, 3) CHECK (climate_suitability >= 0 AND climate_suitability <= 1);
        
        COMMENT ON COLUMN coffee_samples.climate_suitability IS 'Climate suitability score (0-1) calculated during grading';
    END IF;
END $$;

-- Add soil_suitability column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coffee_samples' 
        AND column_name = 'soil_suitability'
    ) THEN
        ALTER TABLE coffee_samples 
        ADD COLUMN soil_suitability NUMERIC(4, 3) CHECK (soil_suitability >= 0 AND soil_suitability <= 1);
        
        COMMENT ON COLUMN coffee_samples.soil_suitability IS 'Soil suitability score (0-1) calculated during grading';
    END IF;
END $$;

-- Add overall_quality_index column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coffee_samples' 
        AND column_name = 'overall_quality_index'
    ) THEN
        ALTER TABLE coffee_samples 
        ADD COLUMN overall_quality_index NUMERIC(4, 3) CHECK (overall_quality_index >= 0 AND overall_quality_index <= 1);
        
        COMMENT ON COLUMN coffee_samples.overall_quality_index IS 'Overall quality index (0-1) combining multiple factors';
    END IF;
END $$;

-- Add elevation_score column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coffee_samples' 
        AND column_name = 'elevation_score'
    ) THEN
        ALTER TABLE coffee_samples 
        ADD COLUMN elevation_score NUMERIC(4, 3) CHECK (elevation_score >= 0 AND elevation_score <= 1);
        
        COMMENT ON COLUMN coffee_samples.elevation_score IS 'Elevation suitability score (0-1) for Robusta coffee';
    END IF;
END $$;

-- Add bean_size_class column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coffee_samples' 
        AND column_name = 'bean_size_class'
    ) THEN
        ALTER TABLE coffee_samples 
        ADD COLUMN bean_size_class VARCHAR(20) CHECK (bean_size_class IN ('Large', 'Medium', 'Small', 'Below Standard'));
        
        COMMENT ON COLUMN coffee_samples.bean_size_class IS 'Bean size classification: Large, Medium, Small, or Below Standard';
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_coffee_samples_bean_screen_size ON coffee_samples(bean_screen_size_mm) WHERE bean_screen_size_mm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coffee_samples_climate_suitability ON coffee_samples(climate_suitability) WHERE climate_suitability IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coffee_samples_quality_index ON coffee_samples(overall_quality_index) WHERE overall_quality_index IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coffee_samples_bean_size_class ON coffee_samples(bean_size_class) WHERE bean_size_class IS NOT NULL;

-- =====================================================
-- Enhancements to harvest_data table
-- =====================================================

-- Add forecasted_yield_kg column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'harvest_data' 
        AND column_name = 'forecasted_yield_kg'
    ) THEN
        ALTER TABLE harvest_data 
        ADD COLUMN forecasted_yield_kg NUMERIC(10, 2);
        
        COMMENT ON COLUMN harvest_data.forecasted_yield_kg IS 'Forecasted total yield in kg (from ML prediction before harvest)';
    END IF;
END $$;

-- Add forecasted_fine_kg column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'harvest_data' 
        AND column_name = 'forecasted_fine_kg'
    ) THEN
        ALTER TABLE harvest_data 
        ADD COLUMN forecasted_fine_kg NUMERIC(10, 2);
        
        COMMENT ON COLUMN harvest_data.forecasted_fine_kg IS 'Forecasted Fine grade quantity in kg';
    END IF;
END $$;

-- Add forecasted_premium_kg column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'harvest_data' 
        AND column_name = 'forecasted_premium_kg'
    ) THEN
        ALTER TABLE harvest_data 
        ADD COLUMN forecasted_premium_kg NUMERIC(10, 2);
        
        COMMENT ON COLUMN harvest_data.forecasted_premium_kg IS 'Forecasted Premium grade quantity in kg';
    END IF;
END $$;

-- Add forecasted_commercial_kg column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'harvest_data' 
        AND column_name = 'forecasted_commercial_kg'
    ) THEN
        ALTER TABLE harvest_data 
        ADD COLUMN forecasted_commercial_kg NUMERIC(10, 2);
        
        COMMENT ON COLUMN harvest_data.forecasted_commercial_kg IS 'Forecasted Commercial grade quantity in kg';
    END IF;
END $$;

-- Add forecast_accuracy_score column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'harvest_data' 
        AND column_name = 'forecast_accuracy_score'
    ) THEN
        ALTER TABLE harvest_data 
        ADD COLUMN forecast_accuracy_score NUMERIC(4, 3) CHECK (forecast_accuracy_score >= 0 AND forecast_accuracy_score <= 1);
        
        COMMENT ON COLUMN harvest_data.forecast_accuracy_score IS 'Accuracy score (0-1) comparing forecasted vs actual yield/grade distribution';
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_harvest_data_forecasted_yield ON harvest_data(forecasted_yield_kg) WHERE forecasted_yield_kg IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_harvest_data_forecast_accuracy ON harvest_data(forecast_accuracy_score) WHERE forecast_accuracy_score IS NOT NULL;

