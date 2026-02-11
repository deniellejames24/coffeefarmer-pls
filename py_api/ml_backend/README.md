# Robusta Coffee ML Backend

Clean, modular ML backend for Robusta coffee grading, yield forecasting, and decision support.

## Structure

```
ml_backend/
├── robusta_ml_core.py      # Pure Python ML logic (no UI dependencies)
├── fastapi_app.py          # FastAPI REST API server
├── models/                 # Saved .pkl model files
├── utils/                  # Helper utilities (if needed)
└── __init__.py             # Package initialization
```

## Features

### Core ML Functions (`robusta_ml_core.py`)

- **Data Loading**: Load and preprocess coffee datasets
- **Feature Engineering**: Calculate suitability scores, quality indices, etc.
- **Grading Functions**: PNS grading, Fine/Premium/Commercial classification
- **Yield Forecasting**: Multi-year yield and grade distribution predictions
- **ML Model Training**: Classification and regression models
- **Recommendation Engine**: Personalized farming recommendations
- **Model Persistence**: Save/load trained models

### FastAPI Server (`fastapi_app.py`)

REST API endpoints:

- `GET /health` - Health check
- `POST /grade` - Predict coffee grade
- `POST /forecast-yield` - Forecast yield and grade distribution
- `POST /predict-quality` - Predict quality grade probabilities
- `POST /recommendations` - Generate personalized recommendations
- `POST /train/grade-classification` - Train classification models
- `POST /train/defect-prediction` - Train regression models
- `GET /models/{model_name}` - Get model information

## Usage

### Running the FastAPI Server

```bash
cd ml_backend
python fastapi_app.py
```

Or with uvicorn:

```bash
uvicorn ml_backend.fastapi_app:app --host 0.0.0.0 --port 8000
```

### Using the Core Module

```python
from ml_backend.robusta_ml_core import predict_grade, predict_yield

# Predict grade
params = {
    'plant_age_months': 48,
    'bean_screen_size_mm': 6.5,
    'primary_defects': 0,
    'secondary_defects': 3,
    'elevation_masl': 900,
    'monthly_temp_avg_c': 19.5,
    'monthly_rainfall_mm': 200,
    'soil_pH': 6.0,
    'soil_moisture_pct': 25
}

result = predict_grade(params)
print(result['predicted_grade'])  # 'Fine', 'Premium', or 'Commercial'
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Dependencies

- pandas
- numpy
- scikit-learn
- fastapi
- uvicorn
- pydantic

## Notes

- All ML logic is pure Python with no Streamlit dependencies
- Models are saved in `models/` directory as `.pkl` files
- The core module can be used independently of the FastAPI server

