-- =====================================================
-- Migration: 006_create_views.sql
-- Description: Create analytics views for ML insights
-- Dependencies: All ML tables and farmer_detail must exist
-- =====================================================

-- =====================================================
-- View: farmer_ml_insights
-- Description: Aggregates ML-related metrics per farmer
-- =====================================================

CREATE OR REPLACE VIEW farmer_ml_insights AS
SELECT 
    f.farmer_id,
    f.id as farmer_detail_id,
    
    -- Forecast metrics
    COUNT(DISTINCT yf.forecast_id) as total_forecasts,
    MAX(yf.forecast_date) as latest_forecast_date,
    AVG((yf.summary_metrics->>'avg_yield_kg_per_ha')::NUMERIC) as avg_forecasted_yield,
    
    -- Quality prediction metrics
    COUNT(DISTINCT qp.prediction_id) as total_quality_predictions,
    MAX(qp.prediction_date) as latest_quality_prediction_date,
    AVG(qp.fine_probability) as avg_fine_probability,
    AVG(qp.premium_probability) as avg_premium_probability,
    AVG(qp.commercial_probability) as avg_commercial_probability,
    
    -- Recommendation metrics
    COUNT(DISTINCT mr.recommendation_id) as total_recommendations,
    COUNT(DISTINCT CASE WHEN mr.status = 'active' THEN mr.recommendation_id END) as active_recommendations,
    COUNT(DISTINCT CASE WHEN mr.status = 'dismissed' THEN mr.recommendation_id END) as dismissed_recommendations,
    COUNT(DISTINCT CASE WHEN mr.status = 'implemented' THEN mr.recommendation_id END) as implemented_recommendations,
    COUNT(DISTINCT CASE WHEN mr.priority = 'critical' AND mr.status = 'active' THEN mr.recommendation_id END) as critical_active_recommendations,
    
    -- Timestamps
    MAX(yf.created_at) as last_forecast_created_at,
    MAX(qp.created_at) as last_quality_prediction_created_at,
    MAX(mr.created_at) as last_recommendation_created_at
    
FROM farmer_detail f
LEFT JOIN yield_forecasts yf ON f.farmer_id = yf.farmer_id
LEFT JOIN quality_predictions qp ON f.farmer_id = qp.farmer_id
LEFT JOIN ml_recommendations mr ON f.farmer_id = mr.farmer_id
GROUP BY f.farmer_id, f.id;

-- Add comment for documentation
COMMENT ON VIEW farmer_ml_insights IS 'Aggregated ML insights per farmer including forecasts, quality predictions, and recommendations';

-- Grant access to the view (same as underlying tables via RLS)
-- Note: RLS on underlying tables will automatically apply to views

-- =====================================================
-- Optional: Additional helper views can be added here
-- =====================================================

-- View: plant_ml_summary (optional - for plant-level insights)
CREATE OR REPLACE VIEW plant_ml_summary AS
SELECT 
    pd.plant_id,
    pd.farmer_id,
    pd.coffee_variety,
    
    -- Latest forecast
    (SELECT yf.forecast_data 
     FROM yield_forecasts yf 
     WHERE yf.plant_id = pd.plant_id 
     ORDER BY yf.forecast_date DESC, yf.created_at DESC 
     LIMIT 1) as latest_forecast_data,
    
    -- Latest quality prediction
    (SELECT jsonb_build_object(
        'fine_probability', qp.fine_probability,
        'premium_probability', qp.premium_probability,
        'commercial_probability', qp.commercial_probability
     )
     FROM quality_predictions qp 
     WHERE qp.plant_id = pd.plant_id 
     ORDER BY qp.prediction_date DESC, qp.created_at DESC 
     LIMIT 1) as latest_quality_prediction,
    
    -- Active recommendations count
    COUNT(DISTINCT CASE WHEN mr.status = 'active' THEN mr.recommendation_id END) as active_recommendations_count,
    
    -- Last update dates
    MAX(yf.forecast_date) as last_forecast_date,
    MAX(qp.prediction_date) as last_quality_prediction_date
    
FROM plant_data pd
LEFT JOIN yield_forecasts yf ON pd.plant_id = yf.plant_id
LEFT JOIN quality_predictions qp ON pd.plant_id = qp.plant_id
LEFT JOIN ml_recommendations mr ON pd.plant_id = mr.plant_id
GROUP BY pd.plant_id, pd.farmer_id, pd.coffee_variety;

COMMENT ON VIEW plant_ml_summary IS 'Plant-level ML summary with latest forecasts, predictions, and recommendations';

