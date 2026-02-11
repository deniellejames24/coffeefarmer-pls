-- =====================================================
-- Robusta Coffee Dashboard Database Schema
-- Multi-Farmer Account Support
-- =====================================================
-- Database: robusta_coffee_db
-- Purpose: Support multiple farmer accounts with farms, 
--          harvests, grading, and predictive analytics
-- =====================================================

-- =====================================================
-- 1. USER AUTHENTICATION & PROFILE
-- =====================================================

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    user_role VARCHAR(20) DEFAULT 'farmer', -- farmer, admin, analyst
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- =====================================================
-- 2. FARM INFORMATION
-- =====================================================

CREATE TABLE farms (
    farm_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    farm_name VARCHAR(100) NOT NULL,
    farm_code VARCHAR(20) UNIQUE, -- Optional unique identifier
    location_province VARCHAR(50),
    location_municipality VARCHAR(50),
    location_barangay VARCHAR(50),
    location_coordinates POINT, -- PostgreSQL POINT type for lat/long
    total_area_hectares DECIMAL(10, 2) NOT NULL,
    elevation_masl INTEGER, -- Elevation in meters above sea level
    established_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_farms_user ON farms(user_id);
CREATE INDEX idx_farms_location ON farms(location_province, location_municipality);

-- =====================================================
-- 3. COFFEE LOTS/PLOTS (Subdivisions within farms)
-- =====================================================

CREATE TABLE coffee_lots (
    lot_id SERIAL PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    lot_name VARCHAR(100) NOT NULL,
    lot_number VARCHAR(20),
    area_hectares DECIMAL(10, 2) NOT NULL,
    planting_date DATE,
    variety VARCHAR(50) DEFAULT 'Robusta',
    spacing_pattern VARCHAR(50), -- e.g., "3m x 2m"
    total_plants INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lots_farm ON coffee_lots(farm_id);

-- =====================================================
-- 4. PLANT MEASUREMENTS & CHARACTERISTICS
-- =====================================================

CREATE TABLE plant_measurements (
    measurement_id SERIAL PRIMARY KEY,
    lot_id INTEGER NOT NULL REFERENCES coffee_lots(lot_id) ON DELETE CASCADE,
    measurement_date DATE NOT NULL,
    plant_age_months INTEGER NOT NULL,
    plant_height_cm DECIMAL(8, 2),
    trunk_diameter_cm DECIMAL(8, 2),
    canopy_width_cm DECIMAL(8, 2),
    number_of_branches INTEGER,
    health_status VARCHAR(20), -- Excellent, Good, Fair, Poor
    environmental_stress_index DECIMAL(5, 3), -- 0.0 to 1.0
    notes TEXT,
    measured_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_measurements_lot ON plant_measurements(lot_id);
CREATE INDEX idx_measurements_date ON plant_measurements(measurement_date);

-- =====================================================
-- 5. ENVIRONMENTAL DATA (Time-series)
-- =====================================================

CREATE TABLE environmental_data (
    env_id SERIAL PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    monthly_temp_avg_c DECIMAL(5, 2),
    monthly_temp_min_c DECIMAL(5, 2),
    monthly_temp_max_c DECIMAL(5, 2),
    monthly_rainfall_mm DECIMAL(8, 2),
    relative_humidity_pct DECIMAL(5, 2),
    soil_pH DECIMAL(4, 2),
    soil_moisture_pct DECIMAL(5, 2),
    soil_organic_matter_pct DECIMAL(5, 2),
    soil_nitrogen_pct DECIMAL(5, 3),
    soil_phosphorus_mg_per_100g DECIMAL(8, 2),
    soil_potassium_mg_per_100g DECIMAL(8, 2),
    sunshine_hours DECIMAL(5, 2),
    wind_speed_kmh DECIMAL(5, 2),
    notes TEXT,
    recorded_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(farm_id, record_date)
);

CREATE INDEX idx_env_farm_date ON environmental_data(farm_id, record_date);

-- =====================================================
-- 6. MANAGEMENT PRACTICES
-- =====================================================

CREATE TABLE management_practices (
    practice_id SERIAL PRIMARY KEY,
    lot_id INTEGER NOT NULL REFERENCES coffee_lots(lot_id) ON DELETE CASCADE,
    practice_date DATE NOT NULL,
    practice_type VARCHAR(50) NOT NULL, -- fertilization, pest_control, pruning, irrigation, etc.
    practice_category VARCHAR(50), -- Organic, Non-Organic, Integrated
    description TEXT,
    fertilization_type VARCHAR(20), -- Organic, Non-Organic
    fertilizer_name VARCHAR(100),
    fertilizer_npk VARCHAR(20), -- e.g., "14-14-14"
    application_rate_kg_per_ha DECIMAL(8, 2),
    pest_management_type VARCHAR(50),
    pest_control_method VARCHAR(100),
    pruning_type VARCHAR(50),
    irrigation_method VARCHAR(50),
    irrigation_amount_mm DECIMAL(8, 2),
    cost_php DECIMAL(10, 2),
    notes TEXT,
    applied_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_practices_lot ON management_practices(lot_id);
CREATE INDEX idx_practices_date ON management_practices(practice_date);
CREATE INDEX idx_practices_type ON management_practices(practice_type);

-- =====================================================
-- 7. HARVEST RECORDS
-- =====================================================

CREATE TABLE harvests (
    harvest_id SERIAL PRIMARY KEY,
    lot_id INTEGER NOT NULL REFERENCES coffee_lots(lot_id) ON DELETE CASCADE,
    harvest_date DATE NOT NULL,
    harvest_season VARCHAR(20), -- Main, Off, Fly
    harvest_method VARCHAR(50), -- Selective, Strip, Mechanical
    cherries_harvested_kg DECIMAL(10, 2),
    green_beans_kg DECIMAL(10, 2), -- After processing
    processing_method VARCHAR(50), -- Wet, Dry, Honey, Natural
    moisture_content_pct DECIMAL(5, 2),
    notes TEXT,
    harvested_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_harvests_lot ON harvests(lot_id);
CREATE INDEX idx_harvests_date ON harvests(harvest_date);

-- =====================================================
-- 8. GRADE ASSESSMENTS (Coffee Quality Grading)
-- =====================================================

CREATE TABLE grade_assessments (
    assessment_id SERIAL PRIMARY KEY,
    harvest_id INTEGER NOT NULL REFERENCES harvests(harvest_id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL,
    sample_weight_g DECIMAL(8, 2) DEFAULT 350.0, -- Standard 350g sample
    
    -- Defect Counts
    primary_defects INTEGER DEFAULT 0,
    secondary_defects INTEGER DEFAULT 0,
    total_defect_count INTEGER,
    total_defect_pct DECIMAL(5, 2),
    
    -- Bean Characteristics
    bean_screen_size_mm DECIMAL(5, 2),
    bean_size_class VARCHAR(20), -- Large, Medium, Small, Below Standard
    bean_count_per_25g INTEGER,
    
    -- Calculated Grades
    pns_grade INTEGER, -- 1-5 (PNS standard)
    coffee_grade VARCHAR(20), -- Fine, Premium, Commercial
    cupping_score DECIMAL(5, 2),
    
    -- Calculated Indices
    climate_suitability_robusta DECIMAL(5, 3),
    soil_suitability_robusta DECIMAL(5, 3),
    moisture_suitability DECIMAL(5, 3),
    overall_quality_index DECIMAL(5, 3),
    environmental_stress_index DECIMAL(5, 3),
    
    -- Defect Details (JSON for flexibility)
    defect_details JSONB, -- Store detailed defect breakdown
    
    -- Assessment Metadata
    assessed_by INTEGER REFERENCES users(user_id),
    assessment_notes TEXT,
    certification_status VARCHAR(50), -- Pending, Certified, Rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assessments_harvest ON grade_assessments(harvest_id);
CREATE INDEX idx_assessments_date ON grade_assessments(assessment_date);
CREATE INDEX idx_assessments_grade ON grade_assessments(coffee_grade);
CREATE INDEX idx_assessments_pns_grade ON grade_assessments(pns_grade);

-- =====================================================
-- 9. PREDICTIONS & FORECASTS
-- =====================================================

CREATE TABLE predictions (
    prediction_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    farm_id INTEGER REFERENCES farms(farm_id) ON DELETE SET NULL,
    lot_id INTEGER REFERENCES coffee_lots(lot_id) ON DELETE SET NULL,
    prediction_type VARCHAR(50) NOT NULL, -- grade_prediction, yield_forecast, defect_prediction
    prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Input Parameters (stored for reference)
    input_parameters JSONB NOT NULL, -- Store all input parameters as JSON
    
    -- Prediction Results
    predicted_grade VARCHAR(20), -- Fine, Premium, Commercial
    predicted_pns_grade INTEGER,
    predicted_defect_pct DECIMAL(5, 2),
    predicted_cupping_score DECIMAL(5, 2),
    confidence_score DECIMAL(5, 3), -- Model confidence
    
    -- Model Information
    model_name VARCHAR(100),
    model_version VARCHAR(20),
    
    -- Notes
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_farm ON predictions(farm_id);
CREATE INDEX idx_predictions_type ON predictions(prediction_type);
CREATE INDEX idx_predictions_date ON predictions(prediction_date);

-- =====================================================
-- 10. YIELD FORECASTS (Multi-year projections)
-- =====================================================

CREATE TABLE yield_forecasts (
    forecast_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    farm_id INTEGER REFERENCES farms(farm_id) ON DELETE SET NULL,
    lot_id INTEGER REFERENCES coffee_lots(lot_id) ON DELETE SET NULL,
    forecast_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    forecast_period_years INTEGER NOT NULL,
    base_year INTEGER NOT NULL,
    
    -- Input Parameters
    plant_age_months INTEGER,
    farm_area_ha DECIMAL(10, 2),
    fertilization_type VARCHAR(20),
    fertilization_frequency INTEGER, -- 1-5 Likert scale
    pest_management_frequency INTEGER, -- 1-5 Likert scale
    climate_suitability DECIMAL(5, 3),
    soil_suitability DECIMAL(5, 3),
    overall_quality_index DECIMAL(5, 3),
    
    -- Forecast Results (stored as JSON for yearly breakdown)
    forecast_data JSONB NOT NULL, -- Array of yearly forecasts
    
    -- Summary Metrics
    total_yield_kg DECIMAL(12, 2),
    avg_yield_per_year_kg_ha DECIMAL(10, 2),
    avg_fine_probability DECIMAL(5, 3),
    avg_premium_probability DECIMAL(5, 3),
    avg_commercial_probability DECIMAL(5, 3),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_forecasts_user ON yield_forecasts(user_id);
CREATE INDEX idx_forecasts_farm ON yield_forecasts(farm_id);
CREATE INDEX idx_forecasts_date ON yield_forecasts(forecast_date);

-- =====================================================
-- 11. RECOMMENDATIONS & ACTION ITEMS
-- =====================================================

CREATE TABLE recommendations (
    recommendation_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    farm_id INTEGER REFERENCES farms(farm_id) ON DELETE SET NULL,
    lot_id INTEGER REFERENCES coffee_lots(lot_id) ON DELETE SET NULL,
    prediction_id INTEGER REFERENCES predictions(prediction_id) ON DELETE SET NULL,
    forecast_id INTEGER REFERENCES yield_forecasts(forecast_id) ON DELETE SET NULL,
    
    recommendation_type VARCHAR(50) NOT NULL, -- yield_optimization, quality_improvement, defect_reduction, etc.
    priority VARCHAR(20) DEFAULT 'Medium', -- High, Medium, Low
    category VARCHAR(50), -- fertilization, pest_control, harvesting, processing, etc.
    
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    action_items TEXT, -- JSON array of specific actions
    expected_impact VARCHAR(100),
    
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, In Progress, Completed, Dismissed
    due_date DATE,
    completed_date DATE,
    completed_by INTEGER REFERENCES users(user_id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recommendations_user ON recommendations(user_id);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_type ON recommendations(recommendation_type);

-- =====================================================
-- 12. ANALYTICS & REPORTS (Optional - for caching)
-- =====================================================

CREATE TABLE analytics_cache (
    cache_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    cache_type VARCHAR(50) NOT NULL, -- dashboard_summary, grade_distribution, yield_trend, etc.
    cache_key VARCHAR(100) NOT NULL, -- Unique identifier for this cache entry
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, cache_type, cache_key)
);

CREATE INDEX idx_cache_user_type ON analytics_cache(user_id, cache_type);
CREATE INDEX idx_cache_expires ON analytics_cache(expires_at);

-- =====================================================
-- 13. AUDIT LOG (Optional - for tracking changes)
-- =====================================================

CREATE TABLE audit_log (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT
    table_name VARCHAR(50),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- =====================================================
-- 14. VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Farmer Dashboard Summary
CREATE VIEW farmer_dashboard_summary AS
SELECT 
    u.user_id,
    u.full_name,
    COUNT(DISTINCT f.farm_id) as total_farms,
    COUNT(DISTINCT cl.lot_id) as total_lots,
    COUNT(DISTINCT h.harvest_id) as total_harvests,
    SUM(h.green_beans_kg) as total_production_kg,
    COUNT(DISTINCT ga.assessment_id) as total_assessments,
    COUNT(DISTINCT CASE WHEN ga.coffee_grade = 'Fine' THEN ga.assessment_id END) as fine_grade_count,
    COUNT(DISTINCT CASE WHEN ga.coffee_grade = 'Premium' THEN ga.assessment_id END) as premium_grade_count,
    AVG(ga.cupping_score) as avg_cupping_score,
    MAX(h.harvest_date) as last_harvest_date
FROM users u
LEFT JOIN farms f ON u.user_id = f.user_id AND f.is_active = TRUE
LEFT JOIN coffee_lots cl ON f.farm_id = cl.farm_id AND cl.is_active = TRUE
LEFT JOIN harvests h ON cl.lot_id = h.lot_id
LEFT JOIN grade_assessments ga ON h.harvest_id = ga.harvest_id
WHERE u.is_active = TRUE
GROUP BY u.user_id, u.full_name;

-- View: Farm Performance Summary
CREATE VIEW farm_performance_summary AS
SELECT 
    f.farm_id,
    f.farm_name,
    f.user_id,
    u.full_name as farmer_name,
    COUNT(DISTINCT cl.lot_id) as total_lots,
    COUNT(DISTINCT h.harvest_id) as total_harvests,
    SUM(h.green_beans_kg) as total_production_kg,
    AVG(ga.cupping_score) as avg_cupping_score,
    AVG(ga.total_defect_pct) as avg_defect_pct,
    COUNT(DISTINCT CASE WHEN ga.coffee_grade = 'Fine' THEN ga.assessment_id END) as fine_count,
    COUNT(DISTINCT CASE WHEN ga.coffee_grade = 'Premium' THEN ga.assessment_id END) as premium_count,
    MAX(h.harvest_date) as last_harvest_date
FROM farms f
JOIN users u ON f.user_id = u.user_id
LEFT JOIN coffee_lots cl ON f.farm_id = cl.farm_id AND cl.is_active = TRUE
LEFT JOIN harvests h ON cl.lot_id = h.lot_id
LEFT JOIN grade_assessments ga ON h.harvest_id = ga.harvest_id
WHERE f.is_active = TRUE
GROUP BY f.farm_id, f.farm_name, f.user_id, u.full_name;

-- =====================================================
-- 15. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_farms_updated_at BEFORE UPDATE ON farms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lots_updated_at BEFORE UPDATE ON coffee_lots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON grade_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recommendations_updated_at BEFORE UPDATE ON recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 16. SAMPLE DATA INSERT (Optional - for testing)
-- =====================================================

-- Insert sample user (password should be hashed in production)
-- INSERT INTO users (username, email, password_hash, full_name, phone_number)
-- VALUES ('farmer1', 'farmer1@example.com', '$2b$12$...', 'Juan Dela Cruz', '+639123456789');

-- =====================================================
-- END OF SCHEMA
-- =====================================================

