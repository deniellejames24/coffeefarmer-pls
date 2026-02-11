-- Admin Verification Schema Changes
-- Add verification status fields to existing tables

-- 1. Add verification status to farmer_detail table
ALTER TABLE farmer_detail 
ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('draft', 'pending', 'approved', 'rejected')),
ADD COLUMN admin_notes TEXT,
ADD COLUMN verified_by UUID REFERENCES users(id),
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add verification status to plant_data table
ALTER TABLE plant_data 
ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('draft', 'pending', 'approved', 'rejected')),
ADD COLUMN admin_notes TEXT,
ADD COLUMN verified_by UUID REFERENCES users(id),
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Add verification status to plant_status table
ALTER TABLE plant_status 
ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('draft', 'pending', 'approved', 'rejected')),
ADD COLUMN admin_notes TEXT,
ADD COLUMN verified_by UUID REFERENCES users(id),
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Add verification status to harvest_data table
ALTER TABLE harvest_data 
ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('draft', 'pending', 'approved', 'rejected')),
ADD COLUMN admin_notes TEXT,
ADD COLUMN verified_by UUID REFERENCES users(id),
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Add verification status to coffee_samples table
ALTER TABLE coffee_samples 
ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('draft', 'pending', 'approved', 'rejected')),
ADD COLUMN admin_notes TEXT,
ADD COLUMN verified_by UUID REFERENCES users(id),
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Create indexes for better performance on verification queries
CREATE INDEX idx_farmer_detail_verification_status ON farmer_detail(verification_status);
CREATE INDEX idx_plant_data_verification_status ON plant_data(verification_status);
CREATE INDEX idx_plant_status_verification_status ON plant_status(verification_status);
CREATE INDEX idx_harvest_data_verification_status ON harvest_data(verification_status);
CREATE INDEX idx_coffee_samples_verification_status ON coffee_samples(verification_status);

-- 7. Create a view for admin dashboard to see all pending verifications
CREATE VIEW admin_verification_dashboard AS
SELECT 
    'farmer_detail' as entity_type,
    id as entity_id,
    verification_status,
    submitted_at,
    verified_at,
    admin_notes,
    verified_by,
    'Farm Details' as display_name
FROM farmer_detail
WHERE verification_status IN ('pending', 'rejected')

UNION ALL

SELECT 
    'plant_data' as entity_type,
    plant_id as entity_id,
    verification_status,
    submitted_at,
    verified_at,
    admin_notes,
    verified_by,
    'Plant Cluster' as display_name
FROM plant_data
WHERE verification_status IN ('pending', 'rejected')

UNION ALL

SELECT 
    'plant_status' as entity_type,
    plant_status_id as entity_id,
    verification_status,
    submitted_at,
    verified_at,
    admin_notes,
    verified_by,
    'Plant Status' as display_name
FROM plant_status
WHERE verification_status IN ('pending', 'rejected')

UNION ALL

SELECT 
    'harvest_data' as entity_type,
    harvest_id as entity_id,
    verification_status,
    submitted_at,
    verified_at,
    admin_notes,
    verified_by,
    'Harvest Report' as display_name
FROM harvest_data
WHERE verification_status IN ('pending', 'rejected')

UNION ALL

SELECT 
    'coffee_samples' as entity_type,
    sample_id as entity_id,
    verification_status,
    submitted_at,
    verified_at,
    admin_notes,
    verified_by,
    'Coffee Sample' as display_name
FROM coffee_samples
WHERE verification_status IN ('pending', 'rejected');

-- 8. Create a function to update verification status and log activity
CREATE OR REPLACE FUNCTION update_verification_status(
    p_table_name TEXT,
    p_entity_id BIGINT,
    p_status VARCHAR(20),
    p_admin_notes TEXT DEFAULT NULL,
    p_admin_user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_sql TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
BEGIN
    -- Get old data for activity log
    EXECUTE format('SELECT to_jsonb(t.*) FROM %I t WHERE %I = $1', 
                   p_table_name, 
                   CASE 
                       WHEN p_table_name = 'farmer_detail' THEN 'id'
                       WHEN p_table_name = 'plant_data' THEN 'plant_id'
                       WHEN p_table_name = 'plant_status' THEN 'plant_status_id'
                       WHEN p_table_name = 'harvest_data' THEN 'harvest_id'
                       WHEN p_table_name = 'coffee_samples' THEN 'sample_id'
                   END)
    INTO v_old_data
    USING p_entity_id;
    
    -- Update verification status
    v_sql := format('UPDATE %I SET 
                        verification_status = $1,
                        admin_notes = $2,
                        verified_by = $3,
                        verified_at = NOW()
                    WHERE %I = $4',
                    p_table_name,
                    CASE 
                        WHEN p_table_name = 'farmer_detail' THEN 'id'
                        WHEN p_table_name = 'plant_data' THEN 'plant_id'
                        WHEN p_table_name = 'plant_status' THEN 'plant_status_id'
                        WHEN p_table_name = 'harvest_data' THEN 'harvest_id'
                        WHEN p_table_name = 'coffee_samples' THEN 'sample_id'
                    END);
    
    EXECUTE v_sql USING p_status, p_admin_notes, p_admin_user_id, p_entity_id;
    
    -- Get new data for activity log
    EXECUTE format('SELECT to_jsonb(t.*) FROM %I t WHERE %I = $1', 
                   p_table_name, 
                   CASE 
                       WHEN p_table_name = 'farmer_detail' THEN 'id'
                       WHEN p_table_name = 'plant_data' THEN 'plant_id'
                       WHEN p_table_name = 'plant_status' THEN 'plant_status_id'
                       WHEN p_table_name = 'harvest_data' THEN 'harvest_id'
                       WHEN p_table_name = 'coffee_samples' THEN 'sample_id'
                   END)
    INTO v_new_data
    USING p_entity_id;
    
    -- Log activity
    INSERT INTO activity_log (
        user_id,
        entity_type,
        entity_id,
        action,
        change_summary,
        old_data,
        new_data
    ) VALUES (
        p_admin_user_id,
        p_table_name,
        p_entity_id,
        'verification_update',
        format('Verification status updated to %s', p_status),
        v_old_data,
        v_new_data
    );
END;
$$ LANGUAGE plpgsql;
