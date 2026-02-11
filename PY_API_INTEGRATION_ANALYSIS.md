# Py_API Integration Analysis for CoffeeFarmer System

## Executive Summary

This document analyzes the integration of the `py_api` folder (containing FastAPI ML backend and Streamlit dashboard) into the existing CoffeeFarmer system. The integration will enhance the system with advanced ML capabilities, yield forecasting, quality distribution predictions, and personalized recommendations while maintaining backward compatibility with existing functionality.

---

## 1. Current System Architecture

### 1.1 Existing Components

**Frontend (React + Vite)**
- React 18 application deployed on GitHub Pages
- Supabase client for database operations
- Current API endpoint: `http://127.0.0.1:7249/predict` (Flask)
- Client-side ML modules in `src/lib/ml/`

**Backend (Supabase)**
- PostgreSQL database with tables:
  - `users`, `farmer_detail`, `plant_data`, `plant_status`
  - `harvest_data`, `coffee_samples`, `activity_log`
- Row Level Security (RLS) enabled
- Real-time subscriptions

**Current API (Flask)**
- Location: `api/coffee_grading_api.py`
- Port: 7249
- Endpoint: `/predict` (GET)
- Functionality: Coffee grade prediction only
- Logic: `api/grading_logic.py`

### 1.2 Py_API Components

**FastAPI ML Backend** (`py_api/ml_backend/`)
- `fastapi_app.py`: FastAPI server with multiple endpoints
- `robusta_ml_core.py`: Core ML functions (no UI dependencies)
- Endpoints:
  - `/grade` (POST) - Grade prediction
  - `/forecast-yield` (POST) - Yield forecasting
  - `/predict-quality` (POST) - Quality distribution
  - `/recommendations` (POST) - Personalized recommendations
  - `/train/*` - Model training endpoints

**Streamlit Dashboard** (`py_api/`)
- `robusta_coffee_dashboard.py`: Standalone analytics dashboard
- `app.py`: Streamlit app entry point
- Uses CSV dataset: `robusta_coffee_dataset.csv`

---

## 2. Integration Strategy

### 2.1 High-Level Approach

**Option A: Replace Flask with FastAPI (Recommended)**
- Migrate Flask API to FastAPI
- Maintain backward compatibility for `/predict` endpoint
- Add new endpoints for advanced features
- Single unified API server

**Option B: Run Both APIs**
- Keep Flask on port 7249 for backward compatibility
- Run FastAPI on port 8000 for new features
- Frontend uses both APIs based on feature

**Option C: Hybrid Approach**
- FastAPI as primary API (port 8000)
- Flask as legacy compatibility layer (port 7249)
- Gradually migrate frontend to FastAPI

**Recommended: Option A** - Cleaner architecture, single API server, easier maintenance.

---

## 3. Database Schema Changes

### 3.1 New Tables Required

#### 3.1.1 `yield_forecasts` Table
```sql
CREATE TABLE yield_forecasts (
    forecast_id BIGSERIAL PRIMARY KEY,
    farmer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plant_id BIGINT REFERENCES plant_data(plant_id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL DEFAULT CURRENT_DATE,
    forecast_years INTEGER NOT NULL DEFAULT 5,
    
    -- Input parameters
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
    
    -- Forecast results (stored as JSONB for flexibility)
    forecast_data JSONB NOT NULL,  -- Yearly forecast breakdown
    summary_metrics JSONB NOT NULL,  -- Total yield, averages, etc.
    suitability_scores JSONB,  -- Climate, soil, quality indices
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    verification_status VARCHAR(20) DEFAULT 'draft',
    admin_notes TEXT,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ
);

CREATE INDEX idx_yield_forecasts_farmer ON yield_forecasts(farmer_id);
CREATE INDEX idx_yield_forecasts_plant ON yield_forecasts(plant_id);
CREATE INDEX idx_yield_forecasts_date ON yield_forecasts(forecast_date);
```

#### 3.1.2 `quality_predictions` Table
```sql
CREATE TABLE quality_predictions (
    prediction_id BIGSERIAL PRIMARY KEY,
    farmer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plant_id BIGINT REFERENCES plant_data(plant_id) ON DELETE CASCADE,
    harvest_id BIGINT REFERENCES harvest_data(harvest_id) ON DELETE SET NULL,
    prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Input parameters
    quality_score NUMERIC(5, 2),
    climate_suitability NUMERIC(4, 3),
    soil_suitability NUMERIC(4, 3),
    fertilization_factor NUMERIC(4, 3),
    pest_factor NUMERIC(4, 3),
    
    -- Prediction results
    fine_probability NUMERIC(4, 3) NOT NULL,
    premium_probability NUMERIC(4, 3) NOT NULL,
    commercial_probability NUMERIC(4, 3) NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    verification_status VARCHAR(20) DEFAULT 'draft'
);

CREATE INDEX idx_quality_predictions_farmer ON quality_predictions(farmer_id);
CREATE INDEX idx_quality_predictions_plant ON quality_predictions(plant_id);
```

#### 3.1.3 `ml_recommendations` Table
```sql
CREATE TABLE ml_recommendations (
    recommendation_id BIGSERIAL PRIMARY KEY,
    farmer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plant_id BIGINT REFERENCES plant_data(plant_id) ON DELETE CASCADE,
    recommendation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Recommendation data (structured JSONB)
    recommendations JSONB NOT NULL,  -- {critical: [], warnings: [], suggestions: [], maintenance: []}
    
    -- Input parameters used (for traceability)
    input_parameters JSONB,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'active',  -- active, dismissed, implemented
    priority VARCHAR(10),  -- critical, high, medium, low
    category VARCHAR(50),  -- fertilization, pest_management, soil, climate, etc.
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    dismissed_at TIMESTAMPTZ,
    implemented_at TIMESTAMPTZ
);

CREATE INDEX idx_ml_recommendations_farmer ON ml_recommendations(farmer_id);
CREATE INDEX idx_ml_recommendations_plant ON ml_recommendations(plant_id);
CREATE INDEX idx_ml_recommendations_status ON ml_recommendations(status);
CREATE INDEX idx_ml_recommendations_priority ON ml_recommendations(priority);
```

#### 3.1.4 `ml_models` Table (Optional - for model versioning)
```sql
CREATE TABLE ml_models (
    model_id BIGSERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    model_type VARCHAR(50) NOT NULL,  -- classification, regression, etc.
    version VARCHAR(20) NOT NULL,
    
    -- Model metadata
    training_date TIMESTAMPTZ NOT NULL,
    training_data_hash VARCHAR(64),  -- SHA256 hash of training data
    feature_columns TEXT[],  -- Array of feature column names
    hyperparameters JSONB,
    
    -- Performance metrics
    accuracy NUMERIC(5, 4),  -- For classification
    r2_score NUMERIC(5, 4),  -- For regression
    rmse NUMERIC(10, 4),  -- For regression
    mae NUMERIC(10, 4),  -- For regression
    
    -- Model file reference (stored in file system or S3)
    model_file_path TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT FALSE,
    is_production BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    notes TEXT
);

CREATE INDEX idx_ml_models_name ON ml_models(model_name);
CREATE INDEX idx_ml_models_active ON ml_models(is_active);
CREATE INDEX idx_ml_models_production ON ml_models(is_production);
```

### 3.2 Schema Enhancements to Existing Tables

#### 3.2.1 `coffee_samples` Table - Add ML Fields
```sql
ALTER TABLE coffee_samples
ADD COLUMN IF NOT EXISTS bean_screen_size_mm NUMERIC(4, 2),
ADD COLUMN IF NOT EXISTS climate_suitability NUMERIC(4, 3),
ADD COLUMN IF NOT EXISTS soil_suitability NUMERIC(4, 3),
ADD COLUMN IF NOT EXISTS overall_quality_index NUMERIC(4, 3),
ADD COLUMN IF NOT EXISTS elevation_score NUMERIC(4, 3),
ADD COLUMN IF NOT EXISTS bean_size_class VARCHAR(20);
```

#### 3.2.2 `harvest_data` Table - Add Forecasting Fields
```sql
ALTER TABLE harvest_data
ADD COLUMN IF NOT EXISTS forecasted_yield_kg NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS forecasted_fine_kg NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS forecasted_premium_kg NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS forecasted_commercial_kg NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS forecast_accuracy_score NUMERIC(4, 3);  -- How close prediction was to actual
```

#### 3.2.3 `plant_data` Table - Add ML-Relevant Fields
```sql
ALTER TABLE plant_data
ADD COLUMN IF NOT EXISTS bean_screen_size_mm NUMERIC(4, 2),  -- Average bean size
ADD COLUMN IF NOT EXISTS last_quality_prediction_date DATE,
ADD COLUMN IF NOT EXISTS last_yield_forecast_date DATE;
```

### 3.3 Database Views for Analytics

#### 3.3.1 View: `farmer_ml_insights`
```sql
CREATE OR REPLACE VIEW farmer_ml_insights AS
SELECT 
    f.farmer_id,
    f.id as farmer_detail_id,
    COUNT(DISTINCT yf.forecast_id) as total_forecasts,
    COUNT(DISTINCT qp.prediction_id) as total_quality_predictions,
    COUNT(DISTINCT mr.recommendation_id) as total_recommendations,
    MAX(yf.forecast_date) as latest_forecast_date,
    MAX(qp.prediction_date) as latest_quality_prediction_date,
    AVG((yf.summary_metrics->>'avg_yield_kg_per_ha')::NUMERIC) as avg_forecasted_yield,
    AVG(qp.fine_probability) as avg_fine_probability,
    COUNT(DISTINCT CASE WHEN mr.status = 'active' THEN mr.recommendation_id END) as active_recommendations
FROM farmer_detail f
LEFT JOIN yield_forecasts yf ON f.farmer_id = yf.farmer_id
LEFT JOIN quality_predictions qp ON f.farmer_id = qp.farmer_id
LEFT JOIN ml_recommendations mr ON f.farmer_id = mr.farmer_id
GROUP BY f.farmer_id, f.id;
```

---

## 4. API Integration Changes

### 4.1 FastAPI Server Setup

#### 4.1.1 Enhanced FastAPI App Structure
```python
# py_api/ml_backend/fastapi_app.py (Enhanced)

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from typing import Optional

# Database connection (Supabase)
from supabase import create_client, Client
import psycopg2
from psycopg2.extras import RealDictCursor

# ML Core imports
from robusta_ml_core import (
    predict_grade,
    predict_yield,
    predict_quality_distribution,
    generate_recommendations
)

app = FastAPI(
    title="CoffeeFarmer ML API",
    description="Unified ML API for coffee grading, forecasting, and recommendations",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection (using Supabase or direct PostgreSQL)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Direct PostgreSQL connection as fallback
DB_CONNECTION_STRING = os.getenv("DATABASE_URL")

def get_db_connection():
    """Get database connection"""
    if supabase:
        return supabase
    elif DB_CONNECTION_STRING:
        return psycopg2.connect(DB_CONNECTION_STRING, cursor_factory=RealDictCursor)
    else:
        raise HTTPException(status_code=500, detail="Database connection not configured")
```

#### 4.1.2 Backward-Compatible `/predict` Endpoint
```python
# Maintain compatibility with existing Flask API
@app.get("/predict")
async def predict_legacy(
    altitude: float = 0,
    bag_weight: float = 0,
    processing_method: int = 0,
    colors: int = 0,
    moisture: float = 0,
    category_one_defects: int = 0,
    category_two_defects: int = 0
):
    """
    Legacy endpoint - maintains compatibility with existing Flask API
    Maps old parameters to new grade prediction endpoint
    """
    try:
        # Convert old parameters to new format
        # Note: Some parameters need to be fetched from database
        # (e.g., plant age, soil pH from plant_status)
        
        # For now, use defaults for missing parameters
        params = {
            'elevation_masl': altitude,
            'primary_defects': category_one_defects,
            'secondary_defects': category_two_defects,
            # Map processing_method and colors to appropriate fields
            # These would need to be stored in coffee_samples table
        }
        
        # Call new prediction function
        result = predict_grade(params)
        
        # Return in old format for backward compatibility
        return {
            'predicted_quality_grade': result['predicted_grade'],
            'cupping_score': result['cupping_score'],
            'pns_grade': result['pns_grade'],
            'total_defect_pct': result['total_defect_pct'],
            'primary_defects': result['primary_defects'],
            'secondary_defects': result['secondary_defects'],
            'total_defects': result['total_defect_count']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### 4.1.3 New Endpoints with Database Integration
```python
@app.post("/grade")
async def grade_with_context(req: GradeRequest, db = Depends(get_db_connection)):
    """
    Enhanced grade prediction with database context
    Can fetch plant data, historical samples, etc.
    """
    try:
        # If plant_id provided, fetch additional context from database
        if hasattr(req, 'plant_id') and req.plant_id:
            plant_data = fetch_plant_data(db, req.plant_id)
            # Merge plant data with request parameters
            params = {**req.dict(), **plant_data}
        else:
            params = req.dict()
        
        result = predict_grade(params)
        
        # Optionally save prediction to database
        if hasattr(req, 'save_to_db') and req.save_to_db:
            save_quality_prediction(db, req.farmer_id, req.plant_id, result)
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/forecast-yield")
async def forecast_yield_with_db(req: YieldRequest, db = Depends(get_db_connection)):
    """
    Yield forecasting with database integration
    Fetches historical data for better predictions
    """
    try:
        params = req.dict()
        
        # Fetch historical harvest data if available
        if req.plant_id:
            historical_data = fetch_historical_harvests(db, req.plant_id)
            # Enhance prediction with historical trends
            params['historical_yields'] = historical_data
        
        result = predict_yield(params)
        
        # Save forecast to database
        if req.save_to_db:
            save_yield_forecast(db, req.farmer_id, req.plant_id, req, result)
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recommendations")
async def get_recommendations_with_db(req: RecommendationRequest, db = Depends(get_db_connection)):
    """
    Generate recommendations with database context
    Considers historical data, current plant status, etc.
    """
    try:
        params = req.dict()
        
        # Fetch current plant status
        if req.plant_id:
            plant_status = fetch_plant_status(db, req.plant_id)
            params.update(plant_status)
        
        # Fetch recent recommendations to avoid duplicates
        recent_recs = fetch_recent_recommendations(db, req.farmer_id, req.plant_id)
        
        result = generate_recommendations(params)
        
        # Filter out duplicate recommendations
        result = filter_duplicate_recommendations(result, recent_recs)
        
        # Save to database
        if req.save_to_db:
            save_recommendations(db, req.farmer_id, req.plant_id, result)
        
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 4.2 Database Helper Functions

```python
# py_api/ml_backend/database_helpers.py

from typing import Dict, List, Optional
from datetime import date

def fetch_plant_data(db, plant_id: int) -> Dict:
    """Fetch plant data for ML predictions"""
    query = """
        SELECT 
            pd.plant_id,
            pd.coffee_variety,
            pd.planting_date,
            pd.elevation as elevation_masl,
            pd.cluster_size,
            EXTRACT(EPOCH FROM (CURRENT_DATE - pd.planting_date)) / 2592000 as plant_age_months
        FROM plant_data pd
        WHERE pd.plant_id = %s
    """
    # Execute query based on database type (Supabase or PostgreSQL)
    # Return as dictionary
    pass

def fetch_plant_status(db, plant_id: int) -> Dict:
    """Fetch latest plant status"""
    query = """
        SELECT 
            ps.soil_ph as soil_pH,
            ps.moisture_level,
            ps.last_fertilized,
            ps.status,
            ps.age_stage
        FROM plant_status ps
        WHERE ps.plant_id = %s
        ORDER BY ps.created_at DESC
        LIMIT 1
    """
    # Execute and return
    pass

def fetch_historical_harvests(db, plant_id: int, years: int = 3) -> List[Dict]:
    """Fetch historical harvest data for trend analysis"""
    query = """
        SELECT 
            harvest_date,
            coffee_dry_quantity,
            coffee_fine_grade,
            coffee_premium_grade,
            coffee_commercial_grade
        FROM harvest_data
        WHERE plant_id = %s
        AND harvest_date >= CURRENT_DATE - INTERVAL '%s years'
        ORDER BY harvest_date DESC
    """
    # Execute and return list of harvests
    pass

def save_yield_forecast(db, farmer_id: str, plant_id: int, request: Dict, result: Dict):
    """Save yield forecast to database"""
    query = """
        INSERT INTO yield_forecasts (
            farmer_id, plant_id, forecast_date, forecast_years,
            plant_age_months, farm_area_ha, elevation_masl,
            monthly_temp_avg_c, monthly_rainfall_mm, soil_pH,
            soil_moisture_pct, fertilization_type, fertilization_frequency,
            pest_management_frequency, forecast_data, summary_metrics,
            suitability_scores, created_by
        ) VALUES (
            %s, %s, CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """
    # Execute insert
    pass

def save_quality_prediction(db, farmer_id: str, plant_id: int, result: Dict):
    """Save quality prediction to database"""
    query = """
        INSERT INTO quality_predictions (
            farmer_id, plant_id, prediction_date,
            fine_probability, premium_probability, commercial_probability,
            quality_score, climate_suitability, soil_suitability,
            created_by
        ) VALUES (
            %s, %s, CURRENT_DATE, %s, %s, %s, %s, %s, %s, %s
        )
    """
    # Execute insert
    pass

def save_recommendations(db, farmer_id: str, plant_id: int, recommendations: Dict):
    """Save recommendations to database"""
    for category, items in recommendations.items():
        for item in items:
            priority = 'critical' if category == 'critical' else 'high' if category == 'warnings' else 'medium'
            query = """
                INSERT INTO ml_recommendations (
                    farmer_id, plant_id, recommendation_date,
                    recommendations, priority, category, status
                ) VALUES (
                    %s, %s, CURRENT_DATE, %s, %s, %s, 'active'
                )
            """
            # Execute insert
    pass
```

---

## 5. Frontend Integration Changes

### 5.1 API Configuration Updates

#### 5.1.1 Enhanced API Config (`src/config/api.js`)
```javascript
/**
 * API Configuration - Enhanced for FastAPI integration
 */

// API base URL - can be overridden via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// Legacy Flask API (for backward compatibility during migration)
const LEGACY_API_BASE_URL = import.meta.env.VITE_LEGACY_API_BASE_URL || 'http://127.0.0.1:7249';

// Coffee grading API endpoints
export const COFFEE_GRADING_API = {
  baseUrl: API_BASE_URL,
  predictEndpoint: `${API_BASE_URL}/predict`,  // Legacy endpoint (backward compatible)
  gradeEndpoint: `${API_BASE_URL}/grade`,  // New POST endpoint
  healthEndpoint: `${API_BASE_URL}/health`,
};

// Yield forecasting API
export const YIELD_FORECAST_API = {
  baseUrl: API_BASE_URL,
  forecastEndpoint: `${API_BASE_URL}/forecast-yield`,
};

// Quality prediction API
export const QUALITY_PREDICTION_API = {
  baseUrl: API_BASE_URL,
  predictEndpoint: `${API_BASE_URL}/predict-quality`,
};

// Recommendations API
export const RECOMMENDATIONS_API = {
  baseUrl: API_BASE_URL,
  recommendationsEndpoint: `${API_BASE_URL}/recommendations`,
};

// Helper function to get full API URL
export const getApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

// Helper function for legacy API (during migration)
export const getLegacyApiUrl = (endpoint) => {
  return `${LEGACY_API_BASE_URL}${endpoint}`;
};

export default {
  COFFEE_GRADING_API,
  YIELD_FORECAST_API,
  QUALITY_PREDICTION_API,
  RECOMMENDATIONS_API,
  getApiUrl,
  getLegacyApiUrl,
};
```

### 5.2 New API Service Functions

#### 5.2.1 ML API Service (`src/lib/api/mlApiService.js`)
```javascript
/**
 * ML API Service - Centralized service for ML endpoints
 */

import axios from 'axios';
import {
  COFFEE_GRADING_API,
  YIELD_FORECAST_API,
  QUALITY_PREDICTION_API,
  RECOMMENDATIONS_API,
} from '../../config/api';

const apiClient = axios.create({
  timeout: 30000,  // 30 second timeout for ML predictions
});

/**
 * Predict coffee grade (new POST endpoint)
 */
export const predictCoffeeGrade = async (params) => {
  try {
    const response = await apiClient.post(COFFEE_GRADING_API.gradeEndpoint, params);
    return response.data;
  } catch (error) {
    console.error('Error predicting coffee grade:', error);
    throw error;
  }
};

/**
 * Forecast yield (new endpoint)
 */
export const forecastYield = async (params) => {
  try {
    const response = await apiClient.post(YIELD_FORECAST_API.forecastEndpoint, params);
    return response.data;
  } catch (error) {
    console.error('Error forecasting yield:', error);
    throw error;
  }
};

/**
 * Predict quality distribution
 */
export const predictQualityDistribution = async (params) => {
  try {
    const response = await apiClient.post(QUALITY_PREDICTION_API.predictEndpoint, params);
    return response.data;
  } catch (error) {
    console.error('Error predicting quality distribution:', error);
    throw error;
  }
};

/**
 * Get personalized recommendations
 */
export const getRecommendations = async (params) => {
  try {
    const response = await apiClient.post(RECOMMENDATIONS_API.recommendationsEndpoint, params);
    return response.data;
  } catch (error) {
    console.error('Error getting recommendations:', error);
    throw error;
  }
};

/**
 * Legacy predict endpoint (backward compatibility)
 */
export const predictCoffeeGradeLegacy = async (params) => {
  try {
    const queryParams = new URLSearchParams(params);
    const response = await fetch(`${COFFEE_GRADING_API.predictEndpoint}?${queryParams.toString()}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error with legacy prediction:', error);
    throw error;
  }
};
```

### 5.3 Frontend Component Updates

#### 5.3.1 Enhanced Harvest Reporting (`src/pages/HarvestReporting.jsx`)
```javascript
// Add new imports
import { predictCoffeeGrade, forecastYield } from '../lib/api/mlApiService';

// Update handleSubmit to use new API
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  setResult(null);
  
  try {
    // Use new POST endpoint with enhanced parameters
    const params = {
      plant_age_months: calculatePlantAge(selectedPlant),
      bean_screen_size_mm: 6.5,  // Default or from plant data
      primary_defects: parseInt(form.category_one_defects),
      secondary_defects: parseInt(form.category_two_defects),
      elevation_masl: plantElevation || 0,
      monthly_temp_avg_c: 19.5,  // Could fetch from weather service
      monthly_rainfall_mm: 200,  // Could fetch from weather service
      soil_pH: currentPlantStatus?.soil_ph || 6.0,
      soil_moisture_pct: parseFloat(currentPlantStatus?.moisture_level) || 25,
      plant_id: selectedPlant,
      farmer_id: user.id,
      save_to_db: true,  // Save prediction to database
    };
    
    const response = await predictCoffeeGrade(params);
    
    if (response.success && response.data) {
      const data = response.data;
      setResult({
        predicted_quality_grade: data.predicted_grade,
        cupping_score: data.cupping_score,
        pns_grade: data.pns_grade,
        total_defect_pct: data.total_defect_pct,
        // Additional fields from new API
        bean_size_class: data.bean_size_class,
        climate_suitability: data.climate_suitability,
        overall_quality_index: data.overall_quality_index,
      });
      
      // Save to coffee_samples table with enhanced fields
      await saveSampleToDatabase(data);
    }
  } catch (error) {
    setError('Failed to connect to the prediction API.');
    console.error('Prediction error:', error);
  } finally {
    setLoading(false);
  }
};
```

#### 5.3.2 New Yield Forecasting Component (`src/pages/YieldForecasting.jsx`)
```javascript
import React, { useState, useEffect } from 'react';
import { forecastYield } from '../lib/api/mlApiService';
import { useSupabase } from '../lib/supabaseClient';

const YieldForecasting = () => {
  const [forecastParams, setForecastParams] = useState({
    plant_age_months: 48,
    farm_area_ha: 1.0,
    elevation_masl: 900,
    monthly_temp_avg_c: 19.5,
    monthly_rainfall_mm: 200,
    soil_pH: 6.0,
    soil_moisture_pct: 25,
    fertilization_type: 'Non-Organic',
    fertilization_frequency: 3,
    pest_management_frequency: 3,
    forecast_years: 5,
  });
  
  const [forecastResult, setForecastResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { supabase, user } = useSupabase();
  
  const handleForecast = async () => {
    setLoading(true);
    try {
      const response = await forecastYield({
        ...forecastParams,
        farmer_id: user.id,
        save_to_db: true,
      });
      
      if (response.success) {
        setForecastResult(response.data);
        
        // Display forecast data
        // Show charts, tables, etc.
      }
    } catch (error) {
      console.error('Forecast error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {/* Forecast form and results display */}
    </div>
  );
};

export default YieldForecasting;
```

#### 5.3.3 Enhanced Recommendations Component (`src/pages/FarmerRecommendations.jsx`)
```javascript
import React, { useState, useEffect } from 'react';
import { getRecommendations } from '../lib/api/mlApiService';
import { useSupabase } from '../lib/supabaseClient';

const FarmerRecommendations = () => {
  const [recommendations, setRecommendations] = useState(null);
  const { supabase, user } = useSupabase();
  
  useEffect(() => {
    loadRecommendations();
  }, []);
  
  const loadRecommendations = async () => {
    try {
      // Fetch current plant status
      const { data: plantStatus } = await supabase
        .from('plant_status')
        .select('*')
        .eq('plant_id', selectedPlantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      // Fetch plant data
      const { data: plantData } = await supabase
        .from('plant_data')
        .select('*')
        .eq('plant_id', selectedPlantId)
        .single();
      
      // Prepare parameters
      const params = {
        plant_age_months: calculateAge(plantData.planting_date),
        soil_pH: plantStatus.soil_ph,
        soil_moisture_pct: parseFloat(plantStatus.moisture_level),
        elevation_masl: plantData.elevation,
        farmer_id: user.id,
        plant_id: selectedPlantId,
        save_to_db: true,
      };
      
      const response = await getRecommendations(params);
      
      if (response.success) {
        setRecommendations(response.data);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };
  
  return (
    <div>
      {recommendations?.critical && (
        <div className="alert alert-critical">
          <h3>Critical Issues</h3>
          <ul>
            {recommendations.critical.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
      {/* Render other recommendation categories */}
    </div>
  );
};

export default FarmerRecommendations;
```

---

## 6. Migration Strategy

### 6.1 Phase 1: Database Setup (Week 1)
1. **Create new tables**: `yield_forecasts`, `quality_predictions`, `ml_recommendations`
2. **Add columns** to existing tables (`coffee_samples`, `harvest_data`, `plant_data`)
3. **Create views** for analytics (`farmer_ml_insights`)
4. **Test database migrations** on development environment
5. **Update RLS policies** for new tables

### 6.2 Phase 2: API Migration (Week 2)
1. **Set up FastAPI server** with database connection
2. **Implement backward-compatible `/predict` endpoint**
3. **Add new endpoints**: `/grade`, `/forecast-yield`, `/predict-quality`, `/recommendations`
4. **Implement database helper functions**
5. **Test API endpoints** with Postman/curl
6. **Deploy FastAPI** alongside Flask (both running)

### 6.3 Phase 3: Frontend Integration (Week 3)
1. **Update API configuration** (`src/config/api.js`)
2. **Create ML API service** (`src/lib/api/mlApiService.js`)
3. **Update existing components** to use new API (with fallback to legacy)
4. **Create new components**: YieldForecasting, EnhancedRecommendations
5. **Test frontend** with both APIs running
6. **Gradually migrate** components from Flask to FastAPI

### 6.4 Phase 4: Testing & Validation (Week 4)
1. **End-to-end testing** of all new features
2. **Performance testing** of ML endpoints
3. **Data validation** - ensure predictions match expected results
4. **User acceptance testing** with sample farmers
5. **Fix bugs** and optimize performance

### 6.5 Phase 5: Deployment (Week 5)
1. **Deploy FastAPI** to production (port 8000)
2. **Update environment variables** in frontend
3. **Monitor API performance** and errors
4. **Gradually migrate traffic** from Flask to FastAPI
5. **Deprecate Flask API** after full migration (optional)

---

## 7. Code Examples

### 7.1 FastAPI Server Entry Point
```python
# py_api/ml_backend/main.py

import uvicorn
from fastapi_app import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=os.getenv("DEBUG", "False").lower() == "true"
    )
```

### 7.2 Environment Configuration
```bash
# .env file for FastAPI
PORT=8000
HOST=0.0.0.0
DEBUG=False

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://user:password@host:port/database

# CORS
CORS_ORIGINS=http://localhost:5173,https://izza3000.github.io

# ML Model Paths
MODEL_DIR=./models
DATASET_PATH=./robusta_coffee_dataset.csv
```

### 7.3 Supabase RLS Policies
```sql
-- RLS Policy for yield_forecasts
CREATE POLICY "Farmers can view their own forecasts"
ON yield_forecasts FOR SELECT
USING (auth.uid() = farmer_id);

CREATE POLICY "Farmers can insert their own forecasts"
ON yield_forecasts FOR INSERT
WITH CHECK (auth.uid() = farmer_id);

CREATE POLICY "Admins can view all forecasts"
ON yield_forecasts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Similar policies for quality_predictions and ml_recommendations
```

---

## 8. Testing Checklist

### 8.1 API Endpoints
- [ ] `/health` - Health check
- [ ] `/predict` (GET) - Legacy endpoint (backward compatibility)
- [ ] `/grade` (POST) - New grade prediction
- [ ] `/forecast-yield` (POST) - Yield forecasting
- [ ] `/predict-quality` (POST) - Quality distribution
- [ ] `/recommendations` (POST) - Recommendations
- [ ] Error handling for invalid inputs
- [ ] Database connection error handling
- [ ] CORS configuration

### 8.2 Database Operations
- [ ] Insert yield forecasts
- [ ] Insert quality predictions
- [ ] Insert recommendations
- [ ] Fetch plant data
- [ ] Fetch historical harvests
- [ ] RLS policies work correctly
- [ ] Data validation constraints

### 8.3 Frontend Integration
- [ ] Coffee grading form uses new API
- [ ] Yield forecasting page works
- [ ] Recommendations display correctly
- [ ] Error messages display properly
- [ ] Loading states work
- [ ] Data persists to database
- [ ] Real-time updates work

### 8.4 Performance
- [ ] API response times < 2 seconds
- [ ] Database queries optimized
- [ ] Frontend doesn't block on API calls
- [ ] Large datasets handled correctly

---

## 9. Potential Issues & Solutions

### 9.1 Issue: Port Conflicts
**Problem**: Flask (7249) and FastAPI (8000) both need to run
**Solution**: 
- Run FastAPI on 8000, Flask on 7249 during migration
- Use environment variables for port configuration
- Consider using a reverse proxy (nginx) in production

### 9.2 Issue: Database Connection Pooling
**Problem**: Multiple API requests may exhaust database connections
**Solution**:
- Use connection pooling (SQLAlchemy, asyncpg)
- Implement connection limits
- Use Supabase connection pooling features

### 9.3 Issue: ML Model Loading
**Problem**: Large ML models slow down API startup
**Solution**:
- Lazy load models on first request
- Cache models in memory
- Use model versioning to load specific versions

### 9.4 Issue: Backward Compatibility
**Problem**: Existing frontend code expects Flask API format
**Solution**:
- Maintain `/predict` endpoint with same response format
- Gradually migrate frontend components
- Use feature flags to toggle between APIs

### 9.5 Issue: Data Migration
**Problem**: Existing data may not have new ML fields
**Solution**:
- Make new fields nullable
- Provide default values
- Create migration scripts to backfill data

---

## 10. Deployment Considerations

### 10.1 Production Setup
- **API Server**: Deploy FastAPI using Gunicorn + Uvicorn workers
- **Database**: Use Supabase connection pooling
- **Environment Variables**: Store securely (not in code)
- **Logging**: Implement structured logging
- **Monitoring**: Set up health checks and alerts

### 10.2 Scaling
- **Horizontal Scaling**: Run multiple FastAPI instances behind load balancer
- **Caching**: Cache frequent predictions (Redis)
- **Database**: Optimize queries, add indexes
- **CDN**: Serve static assets via CDN

### 10.3 Security
- **API Authentication**: Add JWT token validation
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Validate all inputs
- **SQL Injection**: Use parameterized queries
- **CORS**: Restrict to specific origins in production

---

## 11. Terminology Consistency

### 11.1 Field Name Mapping

| Py_API Term | Database Term | Frontend Term | Notes |
|------------|---------------|---------------|-------|
| `elevation_masl` | `elevation` (plant_data) | `plantElevation` | Meters above sea level |
| `plant_age_months` | Calculated from `planting_date` | `plantAge` | Age in months |
| `bean_screen_size_mm` | `bean_screen_size_mm` | `beanScreenSize` | Millimeters |
| `primary_defects` | `category_one_defects` | `categoryOneDefects` | Category 1 defects |
| `secondary_defects` | `category_two_defects` | `categoryTwoDefects` | Category 2 defects |
| `predicted_grade` | `predicted_quality_grade` | `predictedQualityGrade` | Fine/Premium/Commercial |
| `cupping_score` | `cupping_score` | `cuppingScore` | 0-100 score |
| `pns_grade` | `pns_grade` | `pnsGrade` | 1-5 grade |

### 11.2 API Response Format
```json
{
  "success": true,
  "data": {
    "predicted_grade": "Fine",
    "pns_grade": 1,
    "cupping_score": 85.5,
    "total_defect_pct": 2.1,
    "bean_size_class": "Large",
    "climate_suitability": 0.85,
    "soil_suitability": 0.90,
    "overall_quality_index": 0.88
  }
}
```

---

## 12. Next Steps

1. **Review this document** with the development team
2. **Prioritize features** - which endpoints are most critical?
3. **Set up development environment** - FastAPI, database connections
4. **Create database migration scripts** - SQL scripts for new tables
5. **Implement Phase 1** - Database setup
6. **Test incrementally** - Don't wait until the end to test
7. **Document API** - Use FastAPI's automatic OpenAPI docs
8. **Train team** - Ensure team understands new architecture

---

## 13. Additional Resources

- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **Supabase Python Client**: https://github.com/supabase/supabase-py
- **PostgreSQL JSONB**: https://www.postgresql.org/docs/current/datatype-json.html
- **Pydantic Models**: https://pydantic-docs.helpmanual.io/

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: AI Assistant  
**Status**: Analysis Complete - Ready for Implementation

