-- Migration to change farm_elevation column type to support elevation ranges
-- This allows the farm_elevation field to store text like "1100-1500 meters"

-- Change farm_elevation column type from numeric to text to support elevation ranges
ALTER TABLE farmer_detail 
ALTER COLUMN farm_elevation TYPE text;

-- Add comment to document the change
COMMENT ON COLUMN farmer_detail.farm_elevation IS 'Elevation range calculated from plant clusters (e.g., "1100-1500 meters")';

-- Optional: Update existing numeric values to text format
-- UPDATE farmer_detail 
-- SET farm_elevation = farm_elevation || ' meters' 
-- WHERE farm_elevation IS NOT NULL AND farm_elevation ~ '^[0-9]+\.?[0-9]*$'; 