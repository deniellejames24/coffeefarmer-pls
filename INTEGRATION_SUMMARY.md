# Py_API Integration - Quick Summary

## Overview
Integration of `py_api` (FastAPI ML backend) into CoffeeFarmer system to add advanced ML capabilities while maintaining backward compatibility.

---

## Key Changes Required

### 1. Database Schema (4 new tables + enhancements)

**New Tables:**
- `yield_forecasts` - Store multi-year yield predictions
- `quality_predictions` - Store quality grade distribution predictions  
- `ml_recommendations` - Store personalized farming recommendations
- `ml_models` (optional) - Track ML model versions

**Enhanced Tables:**
- `coffee_samples` - Add ML fields (bean_screen_size_mm, climate_suitability, etc.)
- `harvest_data` - Add forecasted yield fields
- `plant_data` - Add ML tracking fields

### 2. API Migration (Flask → FastAPI)

**Current:** Flask API on port 7249, single `/predict` endpoint

**New:** FastAPI on port 8000 with multiple endpoints:
- `/predict` (GET) - Backward compatible legacy endpoint
- `/grade` (POST) - Enhanced grade prediction
- `/forecast-yield` (POST) - Yield forecasting
- `/predict-quality` (POST) - Quality distribution
- `/recommendations` (POST) - Personalized recommendations

**Migration Strategy:** Run both APIs during transition, gradually migrate frontend

### 3. Frontend Updates

**New Files:**
- `src/lib/api/mlApiService.js` - Centralized ML API service

**Updated Files:**
- `src/config/api.js` - Add new endpoint configurations
- `src/pages/HarvestReporting.jsx` - Use new POST endpoint
- `src/pages/CoffeeSampleGrading.jsx` - Enhanced with ML fields

**New Components:**
- `src/pages/YieldForecasting.jsx` - Yield forecasting interface
- Enhanced `src/pages/FarmerRecommendations.jsx` - ML-powered recommendations

### 4. Data Flow Changes

**Before:**
```
Frontend → Flask API (7249) → grading_logic.py → Response
```

**After:**
```
Frontend → FastAPI (8000) → robusta_ml_core.py → Database → Response
         ↓
    (Optional: Save predictions to DB)
```

---

## Implementation Phases

### Phase 1: Database (Week 1)
- Create new tables
- Add columns to existing tables
- Set up RLS policies
- Create analytics views

### Phase 2: API (Week 2)
- Set up FastAPI server
- Implement backward-compatible endpoint
- Add new endpoints
- Connect to database

### Phase 3: Frontend (Week 3)
- Update API configuration
- Create ML API service
- Update existing components
- Create new components

### Phase 4: Testing (Week 4)
- End-to-end testing
- Performance validation
- Bug fixes

### Phase 5: Deployment (Week 5)
- Deploy to production
- Monitor performance
- Complete migration

---

## Critical Code Locations

### Backend
- **FastAPI Server**: `py_api/ml_backend/fastapi_app.py`
- **ML Core**: `py_api/ml_backend/robusta_ml_core.py`
- **Database Helpers**: `py_api/ml_backend/database_helpers.py` (new)
- **Legacy API**: `api/coffee_grading_api.py` (keep for compatibility)

### Frontend
- **API Config**: `src/config/api.js`
- **ML Service**: `src/lib/api/mlApiService.js` (new)
- **Components**: `src/pages/HarvestReporting.jsx`, `src/pages/CoffeeSampleGrading.jsx`

### Database
- **Migrations**: SQL scripts in root directory
- **RLS Policies**: Supabase dashboard or migration scripts

---

## Environment Variables Needed

```bash
# FastAPI
PORT=8000
HOST=0.0.0.0
DEBUG=False

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
DATABASE_URL=postgresql://...

# CORS
CORS_ORIGINS=http://localhost:5173,https://izza3000.github.io
```

---

## Backward Compatibility

✅ **Maintained** - Legacy `/predict` endpoint works exactly as before
✅ **Gradual Migration** - Frontend can use both APIs during transition
✅ **Data Preservation** - No existing data is lost or modified

---

## Key Benefits

1. **Enhanced ML Capabilities** - Yield forecasting, quality distribution, recommendations
2. **Database Integration** - Predictions saved for historical analysis
3. **Better Performance** - FastAPI async support
4. **Type Safety** - Pydantic models for validation
5. **Auto Documentation** - FastAPI generates OpenAPI/Swagger docs
6. **Scalability** - Better architecture for future growth

---

## Testing Checklist

- [ ] All API endpoints respond correctly
- [ ] Database operations work (insert/select)
- [ ] Frontend components display data correctly
- [ ] Backward compatibility maintained
- [ ] RLS policies enforce data isolation
- [ ] Error handling works properly
- [ ] Performance acceptable (<2s response time)

---

## Next Actions

1. Review `PY_API_INTEGRATION_ANALYSIS.md` for detailed specifications
2. Set up development environment
3. Create database migration scripts
4. Implement Phase 1 (Database)
5. Test incrementally

---

**See `PY_API_INTEGRATION_ANALYSIS.md` for complete details.**

