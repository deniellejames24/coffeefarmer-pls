"""
FastAPI Server for Robusta Coffee ML API
Exposes ML endpoints for grading, forecasting, and recommendations
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uvicorn

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))

from robusta_ml_core import (
    predict_grade,
    predict_yield,
    predict_quality_distribution,
    generate_recommendations,
    load_data,
    engineer_features,
    train_grade_classification_model,
    train_defect_prediction_model,
    save_model,
    load_model
)

# Initialize FastAPI app
app = FastAPI(
    title="Robusta Coffee ML API",
    description="API for coffee grading, yield forecasting, and decision support recommendations",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================
# REQUEST MODELS
# =====================================

class GradeRequest(BaseModel):
    """Request model for grade prediction"""
    plant_age_months: int = Field(..., ge=0, le=300, description="Plant age in months")
    bean_screen_size_mm: float = Field(..., ge=4.0, le=9.0, description="Bean screen size in millimeters")
    primary_defects: int = Field(0, ge=0, le=50, description="Number of primary (Category 1) defects")
    secondary_defects: int = Field(0, ge=0, le=50, description="Number of secondary (Category 2) defects")
    elevation_masl: float = Field(900, ge=0, le=3000, description="Elevation in meters above sea level")
    monthly_temp_avg_c: float = Field(19.5, ge=-10.0, le=50.0, description="Average monthly temperature in Celsius")
    monthly_rainfall_mm: float = Field(200, ge=0, le=1000, description="Monthly rainfall in millimeters")
    soil_pH: float = Field(6.0, ge=0.0, le=14.0, description="Soil pH value")
    soil_moisture_pct: float = Field(25, ge=0, le=100, description="Soil moisture percentage")
    environmental_stress_index: Optional[float] = Field(None, ge=0, le=1, description="Environmental stress index (0-1)")
    quality_score: Optional[float] = Field(None, ge=0, le=100, description="Quality score (will be calculated if not provided)")

class YieldRequest(BaseModel):
    """Request model for yield forecasting"""
    plant_age_months: int = Field(..., ge=0, le=300, description="Current plant age in months")
    farm_area_ha: float = Field(1.0, gt=0, le=1000, description="Farm area in hectares")
    elevation_masl: float = Field(900, ge=0, le=3000, description="Elevation in meters above sea level")
    monthly_temp_avg_c: float = Field(19.5, ge=-10.0, le=50.0, description="Average monthly temperature in Celsius")
    monthly_rainfall_mm: float = Field(200, ge=0, le=1000, description="Monthly rainfall in millimeters")
    soil_pH: float = Field(6.0, ge=0.0, le=14.0, description="Soil pH value")
    soil_moisture_pct: float = Field(25, ge=0, le=100, description="Soil moisture percentage")
    fertilization_type: str = Field("Non-Organic", description="Fertilization type: 'Organic' or 'Non-Organic'")
    fertilization_frequency: int = Field(3, ge=1, le=5, description="Fertilization frequency (1=Never, 5=Always)")
    pest_management_frequency: int = Field(3, ge=1, le=5, description="Pest management frequency (1=Never, 5=Always)")
    forecast_years: int = Field(5, ge=1, le=10, description="Number of years to forecast")

class QualityRequest(BaseModel):
    """Request model for quality distribution prediction"""
    quality_score: Optional[float] = Field(None, ge=0, le=1, description="Quality score (0-1)")
    climate_suitability: Optional[float] = Field(None, ge=0, le=1, description="Climate suitability score (0-1)")
    soil_suitability: Optional[float] = Field(None, ge=0, le=1, description="Soil suitability score (0-1)")
    fertilization_factor: Optional[float] = Field(None, ge=0, le=1, description="Fertilization factor (0-1)")
    pest_factor: Optional[float] = Field(None, ge=0, le=1, description="Pest management factor (0-1)")

class RecommendationRequest(BaseModel):
    """Request model for recommendations"""
    plant_age_months: int = Field(48, ge=0, le=300, description="Plant age in months")
    soil_pH: float = Field(6.0, ge=0.0, le=14.0, description="Soil pH value")
    soil_moisture_pct: float = Field(25, ge=0, le=100, description="Soil moisture percentage")
    bean_screen_size_mm: float = Field(6.5, ge=4.0, le=9.0, description="Bean screen size in millimeters")
    elevation_masl: float = Field(900, ge=0, le=3000, description="Elevation in meters above sea level")
    monthly_temp_avg_c: float = Field(19.5, ge=-10.0, le=50.0, description="Average monthly temperature in Celsius")
    monthly_rainfall_mm: float = Field(200, ge=0, le=1000, description="Monthly rainfall in millimeters")
    primary_defects: int = Field(0, ge=0, le=50, description="Number of primary defects")
    secondary_defects: int = Field(3, ge=0, le=50, description="Number of secondary defects")
    environmental_stress_index: Optional[float] = Field(None, ge=0, le=1, description="Environmental stress index")
    quality_score: Optional[float] = Field(None, ge=0, le=100, description="Quality score")
    predicted_grade: Optional[str] = Field(None, description="Predicted grade (will be calculated if not provided)")

# =====================================
# HEALTH CHECK
# =====================================

@app.get("/health")
def health():
    """Health check endpoint"""
    return {"status": "ok", "service": "Robusta Coffee ML API", "version": "1.0.0"}

# =====================================
# GRADE PREDICTION ENDPOINT
# =====================================

@app.post("/grade")
def grade(req: GradeRequest):
    """
    Predict coffee grade based on input parameters
    
    Returns:
        - predicted_grade: Fine, Premium, or Commercial
        - pns_grade: PNS grade (1-5)
        - bean_size_class: Size classification
        - cupping_score: Estimated cupping score
        - total_defect_pct: Total defect percentage
        - suitability scores and quality indices
    """
    try:
        params = req.dict()
        result = predict_grade(params)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error predicting grade: {str(e)}")

# =====================================
# YIELD FORECASTING ENDPOINT
# =====================================

@app.post("/forecast-yield")
def forecast_yield(req: YieldRequest):
    """
    Forecast coffee yield and grade distribution over specified years
    
    Returns:
        - forecast_data: Yearly forecast data
        - summary: Summary metrics
        - suitability_scores: Calculated suitability scores
    """
    try:
        params = req.dict()
        result = predict_yield(params)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error forecasting yield: {str(e)}")

# =====================================
# QUALITY DISTRIBUTION ENDPOINT
# =====================================

@app.post("/predict-quality")
def predict_quality(req: QualityRequest):
    """
    Predict quality grade distribution probabilities
    
    Returns:
        - fine_probability: Probability of Fine grade
        - premium_probability: Probability of Premium grade
        - commercial_probability: Probability of Commercial grade
        - quality_score: Calculated quality score
    """
    try:
        params = req.dict()
        result = predict_quality_distribution(params)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error predicting quality: {str(e)}")

# =====================================
# RECOMMENDATIONS ENDPOINT
# =====================================

@app.post("/recommendations")
def recommendations(req: RecommendationRequest):
    """
    Generate personalized recommendations based on input parameters
    
    Returns:
        - recommendations: Dictionary with categories (critical, warnings, suggestions, maintenance)
    """
    try:
        params = req.dict()
        result = generate_recommendations(params)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

# =====================================
# MODEL TRAINING ENDPOINTS (ADMIN)
# =====================================

@app.post("/train/grade-classification")
def train_grade_model(csv_path: str = "robusta_coffee_dataset.csv"):
    """
    Train grade classification models
    
    Args:
        csv_path: Path to the dataset CSV file
        
    Returns:
        Training results and model metrics
    """
    try:
        # Load and engineer data
        df = load_data(csv_path)
        df_engineered = engineer_features(df)
        
        # Train models
        results = train_grade_classification_model(df_engineered)
        
        # Save best model
        best_model_name = results['best_model']
        best_result = results[best_model_name]
        save_model(
            best_result['model'],
            best_result['scaler'],
            'grade_classification_best',
            best_result['feature_columns']
        )
        
        # Prepare response
        response = {
            "success": True,
            "best_model": best_model_name,
            "accuracy": best_result['accuracy'],
            "models": {
                name: {
                    "accuracy": result['accuracy'],
                    "feature_columns": result['feature_columns']
                }
                for name, result in results.items()
                if name != 'best_model'
            }
        }
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error training model: {str(e)}")

@app.post("/train/defect-prediction")
def train_defect_model(csv_path: str = "robusta_coffee_dataset.csv"):
    """
    Train defect prediction regression models
    
    Args:
        csv_path: Path to the dataset CSV file
        
    Returns:
        Training results and model metrics
    """
    try:
        # Load and engineer data
        df = load_data(csv_path)
        df_engineered = engineer_features(df)
        
        # Train models
        results = train_defect_prediction_model(df_engineered)
        
        # Save best model
        best_model_name = results['best_model']
        best_result = results[best_model_name]
        save_model(
            best_result['model'],
            best_result['scaler'],
            'defect_prediction_best',
            best_result['feature_columns']
        )
        
        # Prepare response
        response = {
            "success": True,
            "best_model": best_model_name,
            "r2": best_result['r2'],
            "rmse": best_result['rmse'],
            "mae": best_result['mae'],
            "models": {
                name: {
                    "r2": result['r2'],
                    "rmse": result['rmse'],
                    "mae": result['mae'],
                    "feature_columns": result['feature_columns']
                }
                for name, result in results.items()
                if name != 'best_model'
            }
        }
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error training model: {str(e)}")

# =====================================
# MODEL LOADING ENDPOINT
# =====================================

@app.get("/models/{model_name}")
def get_model_info(model_name: str):
    """
    Get information about a saved model
    
    Args:
        model_name: Name of the model to load
        
    Returns:
        Model metadata
    """
    try:
        model_data = load_model(model_name)
        return {
            "success": True,
            "model_name": model_name,
            "feature_columns": model_data['feature_columns'],
            "has_model": model_data['model'] is not None,
            "has_scaler": model_data['scaler'] is not None
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading model: {str(e)}")

# =====================================
# ROOT ENDPOINT
# =====================================

@app.get("/")
def root():
    """Root endpoint with API information"""
    return {
        "service": "Robusta Coffee ML API",
        "version": "1.0.0",
        "description": "API for coffee grading, yield forecasting, and decision support",
        "endpoints": {
            "health": "/health",
            "grade": "/grade (POST)",
            "forecast_yield": "/forecast-yield (POST)",
            "predict_quality": "/predict-quality (POST)",
            "recommendations": "/recommendations (POST)",
            "train_grade": "/train/grade-classification (POST)",
            "train_defect": "/train/defect-prediction (POST)",
            "model_info": "/models/{model_name} (GET)"
        },
        "docs": "/docs"
    }

# =====================================
# RUN SERVER
# =====================================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

