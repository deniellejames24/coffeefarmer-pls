# Coffee Grading API - Python Implementation

This Python API replaces the RStudio-based coffee grading system with a Python implementation based on CQI/UCDA Fine Robusta standards.

## Features

- **CQI/UCDA Compliant**: Uses Fine Robusta classification standards
- **Drop-in Replacement**: Compatible with existing R API endpoint
- **Enhanced Output**: Returns additional metadata (cupping score, PNS grade, defect analysis)
- **RESTful API**: Simple HTTP GET endpoint

## Installation

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Verify installation:**
   ```bash
   python -c "from api.grading_logic import predict_coffee_grade; print('OK')"
   ```

## Running the API Server

### Development Mode
```bash
cd api
python coffee_grading_api.py
```

The server will start on `http://127.0.0.1:7249` (same port as R API).

### Production Mode
For production, use a WSGI server like Gunicorn:

```bash
pip install gunicorn
gunicorn -w 4 -b 127.0.0.1:7249 coffee_grading_api:app
```

### Environment Variables
- `PORT`: Server port (default: 7249)
- `HOST`: Server host (default: 127.0.0.1)

Example:
```bash
PORT=8000 HOST=0.0.0.0 python coffee_grading_api.py
```

## API Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "Coffee Grading API",
  "version": "1.0.0"
}
```

### Predict Coffee Grade
```
GET /predict?altitude=900&bag_weight=50&processing_method=0&colors=2&moisture=12&category_one_defects=0&category_two_defects=3
```

**Parameters:**
- `altitude` (optional): Elevation in meters above sea level (default: 0)
- `bag_weight` (optional): Bag weight in kg (kept for compatibility, not used in calculation)
- `processing_method` (required): 0=Washed/Wet, 1=Natural/Dry
- `colors` (required): 0=Green, 1=Bluish-Green, 2=Blue-Green
- `moisture` (required): Moisture percentage (0-20)
- `category_one_defects` (optional): Primary defects count (default: 0)
- `category_two_defects` (optional): Secondary defects count (default: 0)

**Response:**
```json
{
  "predicted_quality_grade": "Fine",
  "cupping_score": 85.2,
  "pns_grade": 1,
  "total_defect_pct": 0.13,
  "primary_defects": 0,
  "secondary_defects": 3,
  "total_defects": 3
}
```

**Grade Values:**
- `"Fine"`: 0 primary defects, ≤5 secondary defects, cupping score ≥80
- `"Premium"`: ≤12 combined defects, cupping score ≥80
- `"Commercial"`: All others

## Testing

### Using curl:
```bash
curl "http://127.0.0.1:7249/predict?altitude=900&processing_method=0&colors=2&moisture=12&category_one_defects=0&category_two_defects=3"
```

### Using Python:
```python
import requests

response = requests.get('http://127.0.0.1:7249/predict', params={
    'altitude': 900,
    'processing_method': 0,
    'colors': 2,
    'moisture': 12,
    'category_one_defects': 0,
    'category_two_defects': 3
})

print(response.json())
```

## Migration from R API

The Python API is designed to be a drop-in replacement:

1. **Same Endpoint**: Uses the same port (7249) and path (`/predict`)
2. **Same Parameters**: Accepts identical query parameters
3. **Enhanced Response**: Returns additional fields but maintains `predicted_quality_grade`

### Frontend Updates

The frontend code in `src/pages/CoffeeSampleGrading.jsx` and `src/pages/HarvestReporting.jsx` should work without changes. However, you may want to:

1. **Update grade handling**: The API now returns "Fine", "Premium", "Commercial" instead of "A", "B", "C"
2. **Use additional fields**: Display cupping score, PNS grade, or defect analysis
3. **Error handling**: The API returns structured error responses

## Grading Standards

### CQI/UCDA Fine Robusta Classification

- **Fine Robusta**: 
  - 0 primary defects
  - ≤5 secondary defects
  - Cupping score ≥80

- **Premium Robusta**:
  - ≤12 combined defects
  - Cupping score ≥80

- **Commercial**:
  - All others

### PNS (Philippine National Standard) Reference

- **Grade 1**: ≤10% defects
- **Grade 2**: ≤15% defects
- **Grade 3**: ≤25% defects
- **Grade 4**: ≤40% defects

## Troubleshooting

### Port Already in Use
If port 7249 is already in use (by R API), either:
1. Stop the R API server
2. Change the Python API port using `PORT` environment variable

### Import Errors
Make sure you're running from the project root:
```bash
cd /path/to/CoffeeFarmer
python api/coffee_grading_api.py
```

### CORS Issues
CORS is enabled by default. If you encounter CORS errors, check that `flask-cors` is installed.

## Development

### Project Structure
```
api/
  ├── coffee_grading_api.py  # Flask API server
  └── grading_logic.py       # Core grading functions
```

### Adding Features
- Modify `grading_logic.py` for grading algorithm changes
- Modify `coffee_grading_api.py` for API changes
- Test with the provided examples

## License

Same as main CoffeeFarmer project.




