"""
Robusta Coffee ML Core Module
Pure Python ML logic for grading, forecasting, and recommendations
No UI dependencies - can be used by FastAPI, Streamlit, or any other interface
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
import pickle

# Machine Learning
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score, 
    mean_squared_error, mean_absolute_error, r2_score
)
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingRegressor
from sklearn.tree import DecisionTreeClassifier

# Model persistence
MODEL_DIR = Path(__file__).parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

# =====================================
# DATA LOADING UTILITIES
# =====================================

def load_data(csv_path: str = 'robusta_coffee_dataset.csv') -> pd.DataFrame:
    """
    Load the coffee dataset
    
    Args:
        csv_path: Path to the CSV file
        
    Returns:
        DataFrame with coffee data
        
    Raises:
        FileNotFoundError: If the dataset file is not found
    """
    csv_file = Path(csv_path)
    if not csv_file.exists():
        # Try relative to parent directory
        csv_file = Path(__file__).parent.parent / csv_path
        if not csv_file.exists():
            raise FileNotFoundError(f"Dataset file '{csv_path}' not found.")
    
    df = pd.read_csv(csv_file)
    return df

# =====================================
# GRADING FUNCTIONS
# =====================================

def calculate_pns_grade(total_defect_pct: float) -> int:
    """
    Calculate PNS grade based on total defect percentage for Robusta
    Grade 1: max 10%
    Grade 2: max 15%
    Grade 3: max 25%
    Grade 4: max 40%
    Grade 5: >40% (Below standard)
    
    Args:
        total_defect_pct: Total defect percentage
        
    Returns:
        PNS grade (1-5)
    """
    if total_defect_pct <= 10:
        return 1
    elif total_defect_pct <= 15:
        return 2
    elif total_defect_pct <= 25:
        return 3
    elif total_defect_pct <= 40:
        return 4
    else:
        return 5  # Below standard

def calculate_fine_premium_grade(primary_defects: int, secondary_defects: int, cupping_score: float = 82.0) -> str:
    """
    Calculate Fine/Premium Robusta grade based on CQI/UCDA standards
    Fine Robusta: 0 primary defects, max 5 secondary defects, score >= 80
    Premium Robusta: max 12 combined defects, score >= 80
    Commercial: otherwise
    
    Args:
        primary_defects: Number of primary (Category 1) defects
        secondary_defects: Number of secondary (Category 2) defects
        cupping_score: Cupping score (default 82)
        
    Returns:
        Grade classification: 'Fine', 'Premium', or 'Commercial'
    """
    if primary_defects == 0 and secondary_defects <= 5 and cupping_score >= 80:
        return 'Fine'
    elif (primary_defects + secondary_defects) <= 12 and cupping_score >= 80:
        return 'Premium'
    else:
        return 'Commercial'

def classify_bean_size(screen_size_mm: float) -> str:
    """
    Classify bean size for Robusta based on screen size
    Large: retained by 5.6mm screen (dry processed) or 7.5mm (wet processed)
    Small: passes through but retained by smaller screens
    
    Args:
        screen_size_mm: Bean screen size in millimeters
        
    Returns:
        Size classification: 'Large', 'Medium', 'Small', or 'Below Standard'
    """
    if screen_size_mm >= 7.5:
        return 'Large'
    elif screen_size_mm >= 6.5:
        return 'Medium'
    elif screen_size_mm >= 5.5:
        return 'Small'
    else:
        return 'Below Standard'

# =====================================
# FEATURE ENGINEERING FUNCTIONS
# =====================================

def calculate_elevation_score(elevation_masl: float) -> float:
    """
    Calculate elevation suitability score for Robusta (600-1200 masl optimal)
    
    Args:
        elevation_masl: Elevation in meters above sea level
        
    Returns:
        Elevation score (0-1)
    """
    elevation_optimal_center = 900  # midpoint of 600-1200
    elevation_optimal_range = 300  # half of the range
    elevation_score = 1 - abs(elevation_masl - elevation_optimal_center) / elevation_optimal_range
    return max(0, min(1, elevation_score))

def calculate_temperature_score(temp_avg_c: float) -> float:
    """
    Calculate temperature suitability score for Robusta (13-26°C optimal)
    
    Args:
        temp_avg_c: Average temperature in Celsius
        
    Returns:
        Temperature score (0-1)
    """
    temp_score = 1 - abs(temp_avg_c - 19.5) / 13
    return max(0, min(1, temp_score))

def calculate_rainfall_score(rainfall_mm: float) -> float:
    """
    Calculate rainfall suitability score for Robusta (200mm optimal)
    
    Args:
        rainfall_mm: Monthly rainfall in millimeters
        
    Returns:
        Rainfall score (0-1)
    """
    rainfall_score = min(rainfall_mm / 200, 1.5)
    return max(0, min(1, rainfall_score))

def calculate_climate_suitability(
    temp_avg_c: float,
    rainfall_mm: float,
    elevation_masl: float
) -> float:
    """
    Calculate overall climate suitability for Robusta
    
    Args:
        temp_avg_c: Average temperature in Celsius
        rainfall_mm: Monthly rainfall in millimeters
        elevation_masl: Elevation in meters above sea level
        
    Returns:
        Climate suitability score (0-1)
    """
    temp_score = calculate_temperature_score(temp_avg_c)
    rainfall_score = calculate_rainfall_score(rainfall_mm)
    elevation_score = calculate_elevation_score(elevation_masl)
    
    climate_suitability = (
        temp_score * 0.3 + 
        rainfall_score * 0.3 + 
        elevation_score * 0.4
    )
    return climate_suitability

def calculate_soil_suitability(soil_pH: float) -> float:
    """
    Calculate soil suitability for Robusta (pH 5.6-6.5 optimal)
    
    Args:
        soil_pH: Soil pH value
        
    Returns:
        Soil suitability score (0-1)
    """
    optimal_ph = 6.0
    soil_suitability = 1 - (abs(soil_pH - optimal_ph) / 1.5)
    return max(0, min(1, soil_suitability))

def calculate_moisture_suitability(soil_moisture_pct: float) -> float:
    """
    Calculate moisture suitability
    
    Args:
        soil_moisture_pct: Soil moisture percentage
        
    Returns:
        Moisture suitability score (0-1)
    """
    moisture_suitability = soil_moisture_pct / 35
    return max(0, min(1, moisture_suitability))

def calculate_environmental_stress(
    temp_avg_c: float,
    rainfall_mm: float,
    soil_pH: float,
    elevation_masl: float
) -> float:
    """
    Calculate environmental stress index
    
    Args:
        temp_avg_c: Average temperature in Celsius
        rainfall_mm: Monthly rainfall in millimeters
        soil_pH: Soil pH value
        elevation_masl: Elevation in meters above sea level
        
    Returns:
        Environmental stress index (0-1)
    """
    temp_stress = abs(temp_avg_c - 19.5) / 13
    rainfall_stress = abs(rainfall_mm - 200) / 200
    ph_stress = abs(soil_pH - 6.0) / 1.5
    elevation_stress = abs(elevation_masl - 900) / 300
    env_stress = (temp_stress + rainfall_stress + ph_stress + elevation_stress) / 4
    return max(0, min(1, env_stress))

def calculate_overall_quality_index(
    climate_suitability: float,
    soil_suitability: float,
    moisture_suitability: float,
    environmental_stress_index: float
) -> float:
    """
    Calculate overall quality index
    
    Args:
        climate_suitability: Climate suitability score
        soil_suitability: Soil suitability score
        moisture_suitability: Moisture suitability score
        environmental_stress_index: Environmental stress index
        
    Returns:
        Overall quality index (0-1)
    """
    overall_quality_index = (
        climate_suitability * 0.3 +
        soil_suitability * 0.3 +
        moisture_suitability * 0.2 +
        (1 - environmental_stress_index) * 0.2
    )
    return overall_quality_index

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create engineered features for Robusta grading
    
    Args:
        df: Input dataframe with coffee data
        
    Returns:
        DataFrame with engineered features
    """
    df_eng = df.copy()
    
    # Ensure we're only working with Robusta variety
    if 'variety' in df_eng.columns:
        df_eng = df_eng[df_eng['variety'].str.lower().str.contains('robusta')].copy()
    
    # Age categories
    df_eng['age_category'] = pd.cut(
        df_eng['plant_age_months'],
        bins=[0, 24, 48, 72, 100],
        labels=['Young', 'Mature', 'Prime', 'Old']
    )
    
    # Calculate total defect percentage (simulated from quality score)
    # Higher quality score = lower defects
    df_eng['total_defect_pct'] = 50 - (df_eng['quality_score'] / 2)
    df_eng['total_defect_pct'] = df_eng['total_defect_pct'].clip(0, 50)
    
    # Simulate primary and secondary defects based on quality
    df_eng['primary_defects'] = (df_eng['total_defect_pct'] * 0.3).round().astype(int)
    df_eng['secondary_defects'] = (df_eng['total_defect_pct'] * 0.7).round().astype(int)
    
    # PNS Grade (1-5)
    df_eng['pns_grade'] = df_eng['total_defect_pct'].apply(calculate_pns_grade)
    
    # Fine/Premium/Commercial classification
    df_eng['coffee_grade'] = df_eng.apply(
        lambda x: calculate_fine_premium_grade(x['primary_defects'], x['secondary_defects'], x['quality_score']),
        axis=1
    )
    
    # Bean screen size (simulated from plant characteristics)
    # Larger, healthier plants tend to produce larger beans
    df_eng['bean_screen_size_mm'] = (
        (df_eng['plant_height_cm'] / 200) * 2 +
        (df_eng['trunk_diameter_cm'] / 15) * 3 +
        4.5
    ).clip(4.0, 9.0)
    
    df_eng['bean_size_class'] = df_eng['bean_screen_size_mm'].apply(classify_bean_size)
    
    # Climate suitability for Robusta
    if 'elevation_masl' in df_eng.columns:
        elevation_scores = df_eng['elevation_masl'].apply(calculate_elevation_score)
    else:
        elevation_scores = pd.Series([0.8] * len(df_eng), index=df_eng.index)
    
    temp_scores = df_eng['monthly_temp_avg_c'].apply(calculate_temperature_score)
    rainfall_scores = df_eng['monthly_rainfall_mm'].apply(calculate_rainfall_score)
    
    df_eng['climate_suitability_robusta'] = (
        temp_scores * 0.4 + 
        rainfall_scores * 0.4 + 
        elevation_scores * 0.2
    )
    
    # Soil suitability for Robusta (pH 5.6-6.5)
    df_eng['soil_suitability_robusta'] = df_eng['soil_pH'].apply(calculate_soil_suitability)
    
    # Moisture suitability
    df_eng['moisture_suitability'] = df_eng['soil_moisture_pct'].apply(calculate_moisture_suitability)
    
    # Environmental stress
    if 'elevation_masl' in df_eng.columns:
        df_eng['environmental_stress_index'] = df_eng.apply(
            lambda x: calculate_environmental_stress(
                x['monthly_temp_avg_c'],
                x['monthly_rainfall_mm'],
                x['soil_pH'],
                x['elevation_masl']
            ),
            axis=1
        )
    
    # Overall quality index
    df_eng['overall_quality_index'] = df_eng.apply(
        lambda x: calculate_overall_quality_index(
            x['climate_suitability_robusta'],
            x['soil_suitability_robusta'],
            x['moisture_suitability'],
            x.get('environmental_stress_index', 0.2)
        ),
        axis=1
    )
    
    # Production ready (Robusta bears fruit at 36 months)
    df_eng['production_ready'] = (df_eng['plant_age_months'] >= 36).astype(int)
    
    return df_eng

# =====================================
# YIELD FORECASTING FUNCTIONS
# =====================================

def get_age_factor(plant_age_months: int) -> float:
    """
    Get age factor for yield calculation based on Robusta production curve
    
    Args:
        plant_age_months: Plant age in months
        
    Returns:
        Age factor (0-1)
    """
    if plant_age_months < 36:
        return 0  # Not yet producing
    elif plant_age_months < 48:
        return 0.5  # Young production
    elif plant_age_months < 72:
        return 0.8  # Growing production
    elif plant_age_months < 120:
        return 1.0  # Prime production
    elif plant_age_months < 180:
        return 0.9  # Mature production
    elif plant_age_months < 240:
        return 0.7  # Declining production
    else:
        return 0.5  # Old trees

def calculate_yield_forecast(
    plant_age_months: int,
    farm_area_ha: float,
    climate_suitability: float,
    soil_suitability: float,
    fertilization_type: str,
    fertilization_frequency: int,
    pest_management_frequency: int,
    bean_screen_size: float,
    overall_quality_index: float,
    forecast_years: int = 5
) -> pd.DataFrame:
    """
    Calculate yield forecast for Robusta coffee per hectare over specified years
    Returns yield per year and grade distribution probabilities
    
    Args:
        plant_age_months: Current plant age in months
        farm_area_ha: Farm area in hectares
        climate_suitability: Climate suitability score (0-1)
        soil_suitability: Soil suitability score (0-1)
        fertilization_type: 'Organic' or 'Non-Organic'
        fertilization_frequency: Frequency scale 1-5 (1=Never, 5=Always)
        pest_management_frequency: Frequency scale 1-5 (1=Never, 5=Always)
        bean_screen_size: Bean screen size in mm
        overall_quality_index: Overall quality index (0-1)
        forecast_years: Number of years to forecast
        
    Returns:
        DataFrame with yearly forecast data
    """
    # Base yield parameters for Robusta (kg/ha/year)
    base_yield_per_ha = 1200  # Average Robusta yield
    max_yield_per_ha = 2500   # Maximum achievable yield
    
    # Fertilization factor
    if fertilization_type == "Organic":
        fert_base = 0.85
    else:  # Non-organic
        fert_base = 1.0
    
    # Frequency multiplier (1=Never to 5=Always)
    fert_freq_multiplier = 0.7 + (fertilization_frequency * 0.075)  # 0.7 to 1.075
    fertilization_factor = fert_base * fert_freq_multiplier
    
    # Pest management factor (1=Never to 5=Always)
    pest_factor = 0.6 + (pest_management_frequency * 0.1)  # 0.6 to 1.0
    
    # Environmental factors
    climate_factor = climate_suitability
    soil_factor = soil_suitability
    quality_factor = overall_quality_index
    
    # Calculate yearly yields
    yearly_data = []
    for year in range(1, forecast_years + 1):
        # Age progression
        future_age_months = plant_age_months + (year * 12)
        future_age_factor = get_age_factor(future_age_months)
        
        # Calculate yield for this year
        year_yield = (base_yield_per_ha * 
                     future_age_factor * 
                     fertilization_factor * 
                     pest_factor * 
                     climate_factor * 
                     soil_factor * 
                     quality_factor)
        
        # Cap at maximum
        year_yield = min(year_yield, max_yield_per_ha)
        
        # Calculate grade probabilities based on management and conditions
        quality_score = (fertilization_factor * 0.3 + 
                        pest_factor * 0.3 + 
                        climate_factor * 0.2 + 
                        soil_factor * 0.2)
        
        # Grade distribution probabilities
        if quality_score >= 0.85:
            fine_prob = 0.6
            premium_prob = 0.35
            commercial_prob = 0.05
        elif quality_score >= 0.75:
            fine_prob = 0.4
            premium_prob = 0.45
            commercial_prob = 0.15
        elif quality_score >= 0.65:
            fine_prob = 0.2
            premium_prob = 0.5
            commercial_prob = 0.3
        else:
            fine_prob = 0.1
            premium_prob = 0.3
            commercial_prob = 0.6
        
        yearly_data.append({
            'Year': year,
            'Age (months)': future_age_months,
            'Yield (kg/ha)': round(year_yield, 2),
            'Total Yield (kg)': round(year_yield * farm_area_ha, 2),
            'Fine Probability': fine_prob,
            'Premium Probability': premium_prob,
            'Commercial Probability': commercial_prob,
            'Fine Yield (kg/ha)': round(year_yield * fine_prob, 2),
            'Premium Yield (kg/ha)': round(year_yield * premium_prob, 2),
            'Commercial Yield (kg/ha)': round(year_yield * commercial_prob, 2)
        })
    
    return pd.DataFrame(yearly_data)

# =====================================
# ML MODEL TRAINING FUNCTIONS
# =====================================

def get_feature_columns() -> List[str]:
    """
    Get standard feature columns for ML models
    
    Returns:
        List of feature column names
    """
    return [
        'plant_age_months', 'bean_screen_size_mm',
        'monthly_temp_avg_c', 'monthly_rainfall_mm',
        'soil_pH', 'soil_moisture_pct',
        'climate_suitability_robusta', 'overall_quality_index',
        'environmental_stress_index'
    ]

def train_grade_classification_model(
    df: pd.DataFrame,
    test_size: float = 0.2,
    random_state: int = 42
) -> Dict[str, Any]:
    """
    Train classification models for coffee grade prediction
    
    Args:
        df: Engineered dataframe with features
        test_size: Proportion of data for testing
        random_state: Random seed
        
    Returns:
        Dictionary with model results, metrics, and trained models
    """
    feature_cols = get_feature_columns()
    
    # Filter to only available columns
    available_cols = [col for col in feature_cols if col in df.columns]
    if len(available_cols) < len(feature_cols):
        print(f"Warning: Some features missing. Using: {available_cols}")
    
    X = df[available_cols]
    y = df['coffee_grade']
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    
    # Scale
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train models
    models = {
        'Random Forest': RandomForestClassifier(n_estimators=150, random_state=random_state, n_jobs=-1),
        'Decision Tree': DecisionTreeClassifier(random_state=random_state, max_depth=10)
    }
    
    results = {}
    for name, model in models.items():
        model.fit(X_train_scaled, y_train)
        y_pred = model.predict(X_test_scaled)
        accuracy = accuracy_score(y_test, y_pred)
        
        results[name] = {
            'model': model,
            'scaler': scaler,
            'accuracy': accuracy,
            'predictions': y_pred,
            'y_test': y_test,
            'feature_columns': available_cols
        }
    
    # Get best model
    best_model_name = max(results.keys(), key=lambda k: results[k]['accuracy'])
    results['best_model'] = best_model_name
    
    return results

def train_defect_prediction_model(
    df: pd.DataFrame,
    test_size: float = 0.2,
    random_state: int = 42
) -> Dict[str, Any]:
    """
    Train regression models for defect percentage prediction
    
    Args:
        df: Engineered dataframe with features
        test_size: Proportion of data for testing
        random_state: Random seed
        
    Returns:
        Dictionary with model results, metrics, and trained models
    """
    feature_cols = [
        'plant_age_months', 'bean_screen_size_mm',
        'monthly_temp_avg_c', 'monthly_rainfall_mm',
        'soil_pH', 'soil_moisture_pct',
        'environmental_stress_index',
        'climate_suitability_robusta',
        'soil_suitability_robusta',
        'overall_quality_index'
    ]
    
    # Filter to only available columns
    available_cols = [col for col in feature_cols if col in df.columns]
    if len(available_cols) < len(feature_cols):
        print(f"Warning: Some features missing. Using: {available_cols}")
    
    X = df[available_cols]
    y = df['total_defect_pct']
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state
    )
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train models
    models = {
        'Random Forest': RandomForestRegressor(n_estimators=150, random_state=random_state, n_jobs=-1),
        'Gradient Boosting': GradientBoostingRegressor(n_estimators=150, random_state=random_state)
    }
    
    results = {}
    for name, model in models.items():
        model.fit(X_train_scaled, y_train)
        y_pred = model.predict(X_test_scaled)
        
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        
        results[name] = {
            'model': model,
            'scaler': scaler,
            'predictions': y_pred,
            'y_test': y_test,
            'rmse': rmse,
            'mae': mae,
            'r2': r2,
            'feature_columns': available_cols
        }
    
    # Get best model
    best_model_name = max(results.keys(), key=lambda k: results[k]['r2'])
    results['best_model'] = best_model_name
    
    return results

# =====================================
# MODEL PERSISTENCE
# =====================================

def save_model(model: Any, scaler: Any, name: str, feature_columns: List[str]) -> None:
    """
    Save a trained model, scaler, and metadata
    
    Args:
        model: Trained model object
        scaler: Fitted scaler object
        name: Model name identifier
        feature_columns: List of feature column names
    """
    model_data = {
        'model': model,
        'scaler': scaler,
        'feature_columns': feature_columns
    }
    
    with open(MODEL_DIR / f"{name}.pkl", "wb") as f:
        pickle.dump(model_data, f)

def load_model(name: str) -> Dict[str, Any]:
    """
    Load a saved model, scaler, and metadata
    
    Args:
        name: Model name identifier
        
    Returns:
        Dictionary with 'model', 'scaler', and 'feature_columns'
        
    Raises:
        FileNotFoundError: If model file doesn't exist
    """
    model_path = MODEL_DIR / f"{name}.pkl"
    if not model_path.exists():
        raise FileNotFoundError(f"Model '{name}' not found at {model_path}")
    
    with open(model_path, "rb") as f:
        return pickle.load(f)

# =====================================
# PREDICTION FUNCTIONS (API-READY)
# =====================================

def predict_grade(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict coffee grade from input parameters
    
    Args:
        params: Dictionary with input parameters:
            - plant_age_months: int
            - bean_screen_size_mm: float
            - primary_defects: int
            - secondary_defects: int
            - elevation_masl: float
            - monthly_temp_avg_c: float
            - monthly_rainfall_mm: float
            - soil_pH: float
            - soil_moisture_pct: float
            - environmental_stress_index: float (optional)
            - quality_score: float (optional, will be calculated if not provided)
    
    Returns:
        Dictionary with predictions and calculated metrics
    """
    # Extract parameters
    plant_age = params.get('plant_age_months', 48)
    bean_screen = params.get('bean_screen_size_mm', 6.5)
    primary_defects = params.get('primary_defects', 0)
    secondary_defects = params.get('secondary_defects', 3)
    elevation = params.get('elevation_masl', 900)
    temp_avg = params.get('monthly_temp_avg_c', 19.5)
    rainfall = params.get('monthly_rainfall_mm', 200)
    soil_ph = params.get('soil_pH', 6.0)
    soil_moisture = params.get('soil_moisture_pct', 25)
    env_stress = params.get('environmental_stress_index')
    quality_score = params.get('quality_score')
    
    # Calculate total defects percentage
    # Assume 350g sample, average bean weight ~0.15g per bean
    total_beans_sample = 350 / 0.15  # approximately 2333 beans
    total_defect_count = primary_defects + secondary_defects
    total_defect_pct = (total_defect_count / total_beans_sample) * 100
    
    # Calculate suitability scores
    elevation_score = calculate_elevation_score(elevation)
    temp_score = calculate_temperature_score(temp_avg)
    rainfall_score = calculate_rainfall_score(rainfall)
    climate_suitability = calculate_climate_suitability(temp_avg, rainfall, elevation)
    soil_suitability = calculate_soil_suitability(soil_ph)
    moisture_suitability = calculate_moisture_suitability(soil_moisture)
    
    # Calculate environmental stress if not provided
    if env_stress is None:
        env_stress = calculate_environmental_stress(temp_avg, rainfall, soil_ph, elevation)
    
    # Calculate overall quality
    overall_quality = calculate_overall_quality_index(
        climate_suitability, soil_suitability, moisture_suitability, env_stress
    )
    
    # Calculate cupping score if not provided
    if quality_score is None:
        cupping_score = 75 + (overall_quality * 20)  # Scale quality to cupping score
    else:
        cupping_score = quality_score
    
    # Predict grade
    predicted_grade = calculate_fine_premium_grade(primary_defects, secondary_defects, cupping_score)
    pns_grade = calculate_pns_grade(total_defect_pct)
    bean_size_class = classify_bean_size(bean_screen)
    
    return {
        'predicted_grade': predicted_grade,
        'pns_grade': pns_grade,
        'bean_size_class': bean_size_class,
        'cupping_score': round(cupping_score, 2),
        'total_defect_pct': round(total_defect_pct, 2),
        'total_defect_count': total_defect_count,
        'primary_defects': primary_defects,
        'secondary_defects': secondary_defects,
        'climate_suitability': round(climate_suitability, 3),
        'soil_suitability': round(soil_suitability, 3),
        'elevation_score': round(elevation_score, 3),
        'overall_quality_index': round(overall_quality, 3),
        'elevation_category': 'Optimal' if 600 <= elevation <= 1200 else 'Sub-optimal'
    }

def predict_yield(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict yield forecast from input parameters
    
    Args:
        params: Dictionary with input parameters:
            - plant_age_months: int
            - farm_area_ha: float
            - elevation_masl: float
            - monthly_temp_avg_c: float
            - monthly_rainfall_mm: float
            - soil_pH: float
            - soil_moisture_pct: float
            - fertilization_type: str ('Organic' or 'Non-Organic')
            - fertilization_frequency: int (1-5)
            - pest_management_frequency: int (1-5)
            - forecast_years: int (default 5)
    
    Returns:
        Dictionary with forecast data and summary metrics
    """
    # Extract parameters
    plant_age = params.get('plant_age_months', 48)
    farm_area = params.get('farm_area_ha', 1.0)
    elevation = params.get('elevation_masl', 900)
    temp_avg = params.get('monthly_temp_avg_c', 19.5)
    rainfall = params.get('monthly_rainfall_mm', 200)
    soil_ph = params.get('soil_pH', 6.0)
    soil_moisture = params.get('soil_moisture_pct', 25)
    fert_type = params.get('fertilization_type', 'Non-Organic')
    fert_freq = params.get('fertilization_frequency', 3)
    pest_freq = params.get('pest_management_frequency', 3)
    forecast_years = params.get('forecast_years', 5)
    
    # Calculate suitability scores
    climate_suitability = calculate_climate_suitability(temp_avg, rainfall, elevation)
    soil_suitability = calculate_soil_suitability(soil_ph)
    moisture_suitability = calculate_moisture_suitability(soil_moisture)
    env_stress = calculate_environmental_stress(temp_avg, rainfall, soil_ph, elevation)
    overall_quality = calculate_overall_quality_index(
        climate_suitability, soil_suitability, moisture_suitability, env_stress
    )
    
    # Calculate forecast
    forecast_df = calculate_yield_forecast(
        plant_age_months=plant_age,
        farm_area_ha=farm_area,
        climate_suitability=climate_suitability,
        soil_suitability=soil_suitability,
        fertilization_type=fert_type,
        fertilization_frequency=fert_freq,
        pest_management_frequency=pest_freq,
        bean_screen_size=6.5,  # Default
        overall_quality_index=overall_quality,
        forecast_years=forecast_years
    )
    
    # Calculate summary metrics
    total_yield_period = forecast_df['Total Yield (kg)'].sum()
    avg_yield_per_year = forecast_df['Yield (kg/ha)'].mean()
    avg_fine_prob = forecast_df['Fine Probability'].mean()
    avg_premium_prob = forecast_df['Premium Probability'].mean()
    
    return {
        'forecast_data': forecast_df.to_dict('records'),
        'summary': {
            'total_yield_kg': round(total_yield_period, 2),
            'avg_yield_kg_per_ha': round(avg_yield_per_year, 2),
            'avg_fine_probability': round(avg_fine_prob, 3),
            'avg_premium_probability': round(avg_premium_prob, 3),
            'forecast_years': forecast_years
        },
        'suitability_scores': {
            'climate_suitability': round(climate_suitability, 3),
            'soil_suitability': round(soil_suitability, 3),
            'overall_quality_index': round(overall_quality, 3)
        }
    }

def predict_quality_distribution(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict quality grade distribution probabilities
    
    Args:
        params: Dictionary with input parameters:
            - quality_score: float (or will be calculated)
            - climate_suitability: float (or will be calculated)
            - soil_suitability: float (or will be calculated)
            - fertilization_factor: float (optional)
            - pest_factor: float (optional)
    
    Returns:
        Dictionary with quality distribution probabilities
    """
    quality_score = params.get('quality_score')
    climate_suitability = params.get('climate_suitability')
    soil_suitability = params.get('soil_suitability')
    fertilization_factor = params.get('fertilization_factor', 0.85)
    pest_factor = params.get('pest_factor', 0.8)
    
    # Calculate quality score if not provided
    if quality_score is None:
        if climate_suitability is None or soil_suitability is None:
            # Use default values
            quality_score = (fertilization_factor * 0.3 + 
                           pest_factor * 0.3 + 
                           0.8 * 0.2 + 
                           0.8 * 0.2)
        else:
            quality_score = (fertilization_factor * 0.3 + 
                           pest_factor * 0.3 + 
                           climate_suitability * 0.2 + 
                           soil_suitability * 0.2)
    
    # Grade distribution probabilities based on quality score
    if quality_score >= 0.85:
        fine_prob = 0.6
        premium_prob = 0.35
        commercial_prob = 0.05
    elif quality_score >= 0.75:
        fine_prob = 0.4
        premium_prob = 0.45
        commercial_prob = 0.15
    elif quality_score >= 0.65:
        fine_prob = 0.2
        premium_prob = 0.5
        commercial_prob = 0.3
    else:
        fine_prob = 0.1
        premium_prob = 0.3
        commercial_prob = 0.6
    
    return {
        'fine_probability': round(fine_prob, 3),
        'premium_probability': round(premium_prob, 3),
        'commercial_probability': round(commercial_prob, 3),
        'quality_score': round(quality_score, 3)
    }

# =====================================
# RECOMMENDATION ENGINE
# =====================================

def generate_recommendations(params: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Generate personalized recommendations based on input parameters
    
    Args:
        params: Dictionary with input parameters:
            - plant_age_months: int
            - soil_pH: float
            - soil_moisture_pct: float
            - quality_score: float (optional)
            - bean_screen_size_mm: float
            - elevation_masl: float
            - environmental_stress_index: float (optional)
            - monthly_temp_avg_c: float
            - monthly_rainfall_mm: float
            - primary_defects: int
            - secondary_defects: int
            - predicted_grade: str (optional)
    
    Returns:
        Dictionary with recommendation categories and messages
    """
    recommendations = {
        'critical': [],
        'warnings': [],
        'suggestions': [],
        'maintenance': []
    }
    
    # Extract parameters
    plant_age = params.get('plant_age_months', 48)
    soil_ph = params.get('soil_pH', 6.0)
    soil_moisture = params.get('soil_moisture_pct', 25)
    bean_screen = params.get('bean_screen_size_mm', 6.5)
    elevation = params.get('elevation_masl', 900)
    temp_avg = params.get('monthly_temp_avg_c', 19.5)
    rainfall = params.get('monthly_rainfall_mm', 200)
    primary_defects = params.get('primary_defects', 0)
    secondary_defects = params.get('secondary_defects', 3)
    predicted_grade = params.get('predicted_grade')
    
    # Calculate grade if not provided
    if predicted_grade is None:
        # Calculate cupping score
        climate_suitability = calculate_climate_suitability(temp_avg, rainfall, elevation)
        soil_suitability = calculate_soil_suitability(soil_ph)
        moisture_suitability = calculate_moisture_suitability(soil_moisture)
        env_stress = calculate_environmental_stress(temp_avg, rainfall, soil_ph, elevation)
        overall_quality = calculate_overall_quality_index(
            climate_suitability, soil_suitability, moisture_suitability, env_stress
        )
        cupping_score = 75 + (overall_quality * 20)
        predicted_grade = calculate_fine_premium_grade(primary_defects, secondary_defects, cupping_score)
    
    # Grade-based recommendations
    if predicted_grade == 'Commercial':
        recommendations['critical'].append(
            "Coffee graded as Commercial - Below Fine/Premium standards"
        )
        recommendations['critical'].extend([
            "Reduce defects through better harvesting (selective picking only)",
            "Improve processing: Proper fermentation (18-24hrs), clean water, timely drying",
            "Better sorting: Remove all defective beans before final processing",
            "Quality control: Regular inspection and grading throughout process"
        ])
    
    # Primary defects
    if primary_defects > 0:
        recommendations['critical'].append("Primary defects detected! These are critical quality issues.")
        recommendations['critical'].extend([
            "Check for mold during storage (control humidity <60%)",
            "Prevent over-fermentation (max 24 hours)",
            "Avoid harvesting overripe or ground cherries",
            "Implement pest control for coffee berry borer"
        ])
    
    # Secondary defects
    if secondary_defects > 5:
        recommendations['warnings'].append("High secondary defects - Exceeds Fine Robusta standards")
        recommendations['warnings'].extend([
            "Harvest only ripe cherries (avoid immature/green)",
            "Careful handling to prevent breakage",
            "Proper drying (avoid over/under drying)",
            "Improve soil fertility and plant nutrition"
        ])
    
    # Temperature
    if temp_avg < 13 or temp_avg > 26:
        recommendations['warnings'].append(
            f"Temperature ({temp_avg}°C) outside optimal range (13-26°C)"
        )
        recommendations['suggestions'].extend([
            "Implement shade management (30-40% coverage)",
            "Consider windbreaks for temperature moderation"
        ])
    
    # Elevation
    if elevation < 600:
        recommendations['warnings'].append(
            f"Elevation ({elevation}m) below optimal range (600-1,200 masl)"
        )
        recommendations['suggestions'].extend([
            "Robusta performs best at 600-1,200 masl",
            "Lower elevations may result in lower quality beans",
            "Consider improved agronomic practices to compensate"
        ])
    elif elevation > 1200:
        recommendations['warnings'].append(
            f"Elevation ({elevation}m) above optimal range (600-1,200 masl)"
        )
        recommendations['suggestions'].extend([
            "Robusta may experience stress at higher elevations",
            "Consider switching to Arabica for elevations >900 masl",
            "Implement cold protection measures if needed"
        ])
    
    # Rainfall
    if rainfall < 150:
        recommendations['warnings'].append(
            f"Low rainfall ({rainfall}mm) - Below optimal 200mm"
        )
        recommendations['suggestions'].extend([
            "Implement drip irrigation during dry periods",
            "Apply mulching to retain soil moisture"
        ])
    
    # Soil pH
    if soil_ph < 5.6:
        recommendations['warnings'].append(f"Soil pH ({soil_ph}) too acidic")
        recommendations['suggestions'].append(
            "Apply agricultural lime to increase pH to 5.6-6.5 range"
        )
    elif soil_ph > 6.5:
        recommendations['warnings'].append(f"Soil pH ({soil_ph}) too alkaline")
        recommendations['suggestions'].append(
            "Apply sulfur or organic matter to decrease pH"
        )
    
    # Bean size
    if bean_screen < 6.5:
        recommendations['suggestions'].append("Bean size below optimal - Focus on:")
        recommendations['suggestions'].extend([
            "Improve plant nutrition (complete fertilizer 14-14-14)",
            "Ensure adequate water during cherry development",
            "Proper spacing (3m x 2m) for better growth"
        ])
    
    # Plant age
    if plant_age < 36:
        recommendations['suggestions'].append(
            "Plant not yet mature - Robusta production starts at 36 months"
        )
        recommendations['suggestions'].extend([
            "Continue vegetative growth management",
            "Focus on pruning and desuckering"
        ])
    
    # Positive feedback
    if predicted_grade in ['Fine', 'Premium']:
        recommendations['maintenance'].append(
            f"Excellent! Meets {predicted_grade} Robusta standards"
        )
        recommendations['maintenance'].extend([
            "Continue current best practices",
            "Regular monitoring of all parameters",
            "Consistent quality control procedures",
            "Proper post-harvest handling and storage"
        ])
        
        if predicted_grade == 'Fine':
            recommendations['maintenance'].append(
                "Premium Market Ready! Your coffee qualifies for specialty markets."
            )
    
    # Remove empty categories
    return {k: v for k, v in recommendations.items() if v}

