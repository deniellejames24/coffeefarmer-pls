-- Migration to add elevation and cluster_size columns to plant_data table
-- This allows each coffee plant to have its own specific elevation and cluster size

-- Add elevation column to plant_data table
ALTER TABLE plant_data 
ADD COLUMN elevation float8 CHECK (elevation >= 0);

-- Add cluster_size column to plant_data table (in square meters)
ALTER TABLE plant_data 
ADD COLUMN cluster_size float8 CHECK (cluster_size > 0);

-- Change farm_elevation column type from numeric to text to support elevation ranges
ALTER TABLE farmer_detail 
ALTER COLUMN farm_elevation TYPE text;

-- Add comments to document the new columns
COMMENT ON COLUMN plant_data.elevation IS 'Elevation of the specific plant cluster in meters above sea level';
COMMENT ON COLUMN plant_data.cluster_size IS 'Size of the plant cluster in square meters';
COMMENT ON COLUMN farmer_detail.farm_elevation IS 'Elevation range calculated from plant clusters (e.g., "1100-1500 meters")';

-- Update existing records to have default values if needed
-- Note: This is optional and depends on your data requirements
-- UPDATE plant_data SET elevation = 0 WHERE elevation IS NULL;
-- UPDATE plant_data SET cluster_size = 1000 WHERE cluster_size IS NULL; 