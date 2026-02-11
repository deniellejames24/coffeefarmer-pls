# RStudio to Python Migration Plan

## Current System Analysis

### RStudio Implementation (Current)
- **API Endpoint**: `http://127.0.0.1:7249/predict`
- **Input Parameters**:
  - `altitude` (elevation in meters)
  - `bag_weight` (kg)
  - `processing_method` (0=Washed/Wet, 1=Natural/Dry)
  - `colors` (0=Green, 1=Bluish-Green, 2=Blue-Green)
  - `moisture` (percentage, 0-20)
  - `category_one_defects` (primary defects count)
  - `category_two_defects` (secondary defects count)
- **Output**: 
  ```json
  {
    "predicted_quality_grade": "A" | "B" | "C"
  }
  ```
- **Used in**:
  - `src/pages/CoffeeSampleGrading.jsx`
  - `src/pages/HarvestReporting.jsx`

### Python Implementation (Target)
- **Source**: `py try/robusta_coffee_dashboard.py`
- **Grading Functions**:
  - `calculate_fine_premium_grade(primary_defects, secondary_defects, cupping_score)` → Returns "Fine" | "Premium" | "Commercial"
  - `calculate_pns_grade(total_defect_pct)` → Returns 1-5 (PNS grade)
- **Grading Standards** (CQI/UCDA Fine Robusta):
  - **Fine Robusta**: 0 primary defects, ≤5 secondary defects, cupping score ≥80
  - **Premium Robusta**: ≤12 combined defects, cupping score ≥80
  - **Commercial**: All others
- **Cupping Score Calculation**: Based on overall quality index (75 + quality * 20)

## Migration Strategy

### Step 1: Extract Core Logic
Extract the grading functions from the Streamlit app into a standalone Python module that can be used by an API server.

### Step 2: Create Python API Server
Create a Flask/FastAPI server that:
- Accepts the same input parameters as the R API
- Maps input parameters to Python function parameters
- Returns the same JSON format for compatibility

### Step 3: Parameter Mapping
- `category_one_defects` → `primary_defects` ✓
- `category_two_defects` → `secondary_defects` ✓
- Calculate `cupping_score` from: altitude, processing_method, colors, moisture
- Map output: "Fine" → "A", "Premium" → "B", "Commercial" → "C" (or keep original names)

### Step 4: Update Frontend
- Update API endpoint URL (configurable via environment variable)
- Handle new grade names if changed
- Maintain backward compatibility with existing data

## Implementation Files

1. **`api/coffee_grading_api.py`** - Flask/FastAPI server
2. **`api/grading_logic.py`** - Extracted grading functions
3. **`requirements.txt`** - Python dependencies
4. **`.env.example`** - Environment configuration
5. **`README_API.md`** - API setup and usage instructions

## Grade Mapping Options

### Option A: Keep Python Names (Recommended)
- Return: "Fine", "Premium", "Commercial"
- Update frontend to handle both old ("A", "B", "C") and new names
- More descriptive and aligned with industry standards

### Option B: Map to Old Names
- "Fine" → "A"
- "Premium" → "B"  
- "Commercial" → "C"
- Maintains exact compatibility but loses descriptive names

## Testing Checklist

- [ ] API server starts and responds to health check
- [ ] Prediction endpoint returns correct format
- [ ] All input parameter combinations work
- [ ] Grade calculations match Python dashboard
- [ ] Frontend integration works
- [ ] Backward compatibility with existing data
- [ ] Error handling for invalid inputs




