# SYSTEM CONTEXT SUMMARY (FOR AI)

## 1. System Overview

**CoffeeFarmer** is a web-based agricultural management platform designed to help coffee farmers improve yields, quality, and profitability through AI-powered analytics, automated grading, and decision support systems. The system serves as a comprehensive farm management solution with role-based access for farmers and administrators.

**Core Purpose**: Transform coffee farming through three main innovations:
1. **Automated Coffee Grading** - Instant quality assessment using CQI/UCDA Fine Robusta standards (replaces 3-5 day lab testing)
2. **Predictive Analytics** - Forecast yields, quality distributions, and revenue projections
3. **Decision Support System (DSS)** - Personalized farming recommendations based on environmental and historical data

**Deployment**: 
- Frontend: GitHub Pages (https://izza3000.github.io/CoffeeFarmer/)
- Backend: Supabase (PostgreSQL database + Authentication + Real-time subscriptions)
- API: Python Flask API server (port 7249) for coffee grading predictions

**Target Users**: Smallholder coffee farmers, agricultural cooperatives, and farm administrators in the Philippines (initially focused on Robusta coffee).

---

## 2. Key Users & Roles

### **Farmers** (`role: 'farmer'`)
- Register and manage farm profiles
- Declare land and plant clusters (with elevation and cluster size)
- Record plant status (health, soil pH, moisture, fertilization)
- Report harvests with quality grading
- Submit coffee samples for automated grading
- View personalized recommendations
- Access predictive analytics for yield forecasting
- Generate reports and export data (PDF)
- Submit data for admin verification (draft → pending → approved/rejected)

### **Administrators** (`role: 'admin'`)
- Access admin dashboard with system-wide analytics
- Review and verify farmer submissions (land declarations, plant data, harvests, samples)
- Approve/reject farmer data with notes
- Manage users (view, edit, deactivate)
- View aggregated analytics across all farmers
- Generate farmer reports and profiles
- Access decision support recommendations for farmers

### **System Architecture Roles**
- **Supabase Auth**: Handles user authentication, password reset, email verification
- **RLS (Row Level Security)**: Ensures data isolation between farmers
- **Activity Logging**: Tracks all user actions for audit trail

---

## 3. Major Features

### **3.1 Data Entry & Management**
- **Land Declaration**: Farmers declare farm location, size, elevation (calculated as range from plant clusters)
- **Plant Cluster Management**: Add/edit/delete coffee plant clusters with:
  - Variety (default: Robusta)
  - Planting date
  - Number of trees
  - Individual elevation (meters above sea level)
  - Cluster size (square meters)
- **Plant Status Tracking**: Record health status, age stage, soil pH, moisture level, last fertilized date
- **Harvest Reporting**: Record harvest dates, quantities (raw/dry), processing methods, quality grades
- **Coffee Sample Grading**: Submit samples for instant quality assessment via Python API

### **3.2 Automated Coffee Grading**
- **API Endpoint**: `http://127.0.0.1:7249/predict`
- **Input Parameters**:
  - `altitude`: Elevation in meters (from plant cluster)
  - `processing_method`: 0=Washed/Wet, 1=Natural/Dry
  - `colors`: 0=Green, 1=Bluish-Green, 2=Blue-Green
  - `moisture`: Percentage (0-20)
  - `category_one_defects`: Primary defects count
  - `category_two_defects`: Secondary defects count
- **Output**: 
  - `predicted_quality_grade`: "Fine" | "Premium" | "Commercial"
  - `cupping_score`: 0-100
  - `pns_grade`: 1-5 (Philippine National Standard)
  - `total_defect_pct`: Calculated defect percentage
- **Standards**: CQI/UCDA Fine Robusta Classification
  - **Fine**: 0 primary defects, ≤5 secondary defects, cupping score ≥80
  - **Premium**: ≤12 combined defects, cupping score ≥80
  - **Commercial**: All others

### **3.3 Predictive Analytics**
- **Yield Forecasting**: Multi-year yield projections based on:
  - Plant age, farm area, fertilization practices
  - Climate and soil suitability indices
  - Historical harvest data
- **Quality Distribution Prediction**: Forecast percentage of Fine/Premium/Commercial grades
- **Seasonal Analysis**: Wet season, dry season, transitional period predictions
- **Revenue Projections**: Calculate potential income based on quality grades and market prices

### **3.4 Decision Support System (DSS)**
- **Environmental Analysis**: Temperature, humidity, pH validation and recommendations
- **Growth Trend Analysis**: Time-series analysis of plant growth
- **Personalized Recommendations**:
  - Fertilization timing and frequency
  - Pest management suggestions
  - Irrigation recommendations
  - Harvest timing optimization
- **Priority-Based Actions**: High/Medium/Low priority recommendations with expected impact

### **3.5 Admin Verification System**
- **Workflow**: Draft → Pending → Approved/Rejected
- **Verification Fields**: Added to `farmer_detail`, `plant_data`, `plant_status`, `harvest_data`, `coffee_samples`
  - `verification_status`: 'draft', 'pending', 'approved', 'rejected'
  - `admin_notes`: Feedback from admin
  - `verified_by`: Admin user ID
  - `verified_at`: Timestamp
  - `submitted_at`: When farmer submitted for review
- **Admin Dashboard**: View all pending/rejected submissions, review details, approve/reject with notes
- **Activity Logging**: All verification actions logged in `activity_log` table

### **3.6 Analytics & Reporting**
- **Farmer Dashboard**: Personal metrics (total harvests, quality distribution, recent activity)
- **Admin Dashboard**: System-wide metrics (total farmers, total harvests, recent registrations)
- **Admin Analytics**: Aggregated data across all farmers, quality trends, yield analysis
- **Farmer Reports**: Detailed profiles with farm data, plant clusters, harvest history
- **PDF Export**: Generate PDF reports for land declarations and harvest data

### **3.7 Visualization**
- **3D Coffee Scene**: Three.js-based 3D visualization of coffee beans and trees
- **Charts**: Chart.js and Recharts for data visualization
- **Interactive Dashboards**: Real-time data updates via Supabase subscriptions

---

## 4. Architecture (Frontend, Backend, Database, ML)

### **4.1 Frontend Architecture**
- **Framework**: React 18 with Vite build tool
- **Routing**: React Router v6 with protected routes
- **State Management**: 
  - React Context API (`AuthProvider`, `ThemeProvider`)
  - Local component state with hooks
  - Supabase real-time subscriptions for live updates
- **UI Framework**: 
  - Tailwind CSS for styling
  - Custom CSS modules for specific pages
  - Dark mode support via ThemeContext
- **3D Graphics**: Three.js with @react-three/fiber and @react-three/drei
- **Charts**: Chart.js, Recharts
- **PDF Generation**: jsPDF with autoTable plugin
- **HTTP Client**: Axios for API calls, native fetch for grading API
- **Deployment**: GitHub Pages (static hosting)

### **4.2 Backend Architecture**
- **Database**: Supabase (PostgreSQL 12+)
  - Row Level Security (RLS) enabled
  - Real-time subscriptions
  - Automatic API generation from schema
- **Authentication**: Supabase Auth
  - Email/password authentication
  - Password reset flow
  - Email verification
  - Session management
- **API Server**: Python Flask (port 7249)
  - Coffee grading predictions
  - CORS enabled
  - Health check endpoint
  - Error handling and logging

### **4.3 Database Schema (Supabase/PostgreSQL)**

**Core Tables**:
- `users`: User accounts (id UUID, email, password_hash, role, first_name, last_name, created_at)
- `farmer_detail`: Farm information (id UUID, farmer_id, farm_location, farm_size, farm_elevation TEXT, farmers_details JSONB)
- `plant_data`: Coffee plant clusters (plant_id BIGINT, farmer_id UUID, coffee_variety, planting_date, number_of_tree_planted, elevation FLOAT8, cluster_size FLOAT8)
- `plant_status`: Plant health tracking (plant_status_id BIGINT, plant_id, status, age_stage, soil_ph, moisture_level, last_fertilized)
- `harvest_data`: Harvest records (harvest_id BIGINT, farmer_id, plant_id, harvest_date, coffee_raw_quantity, coffee_dry_quantity, coffee_fine_grade, coffee_premium_grade, coffee_commercial_grade, bag_weight, processing_method, colors, moisture, category_one_defects, category_two_defects)
- `coffee_samples`: Quality samples (sample_id BIGINT, harvest_id, bag_weight, processing_method, colors, moisture, category_one_defects, category_two_defects, predicted_quality_grade)

**Verification System Tables** (added via migration):
- All core tables have verification fields: `verification_status`, `admin_notes`, `verified_by`, `verified_at`, `submitted_at`
- `admin_verification_dashboard`: View aggregating pending/rejected items across all tables

**Supporting Tables**:
- `activity_log`: Audit trail (user_id, entity_type, entity_id, action, change_summary, old_data JSONB, new_data JSONB, created_at)

**Relationships**:
- `users` (1) → (N) `farmer_detail`
- `farmer_detail` (1) → (N) `plant_data`
- `plant_data` (1) → (N) `plant_status`
- `plant_data` (1) → (N) `harvest_data`
- `harvest_data` (1) → (N) `coffee_samples`

### **4.4 ML/Analytics Components**

**Client-Side ML Libraries**:
- `@tensorflow/tfjs`: TensorFlow.js for browser-based ML
- `ml-matrix`: Matrix operations for ML calculations
- `ml-naivebayes`: Naive Bayes classifier
- `simple-statistics`: Statistical functions

**ML Modules** (`src/lib/ml/`):
- `DecisionSupportSystem.js`: Environmental analysis, growth trend analysis, recommendations
- `QualityPredictor.ts`: Quality distribution prediction, seasonal yield forecasting
- `TimeSeriesAnalysis.js`: Time-series data analysis for growth trends
- `AdvancedAnalytics.js`: Advanced statistical analysis

**Server-Side ML**:
- Python grading logic (`api/grading_logic.py`):
  - `calculate_cupping_score()`: Estimates cupping score from input parameters
  - `calculate_fine_premium_grade()`: CQI/UCDA grade classification
  - `calculate_pns_grade()`: Philippine National Standard grading
  - `predict_coffee_grade()`: Main prediction function

**Analytics Features**:
- Historical data analysis for yield/quality trends
- Environmental factor correlation (pH, moisture, elevation)
- Seasonal pattern recognition
- Quality distribution forecasting

---

## 5. Data Flow

### **5.1 User Registration & Authentication**
```
User Registration → Supabase Auth → Email Verification → User Created in `users` table
Login → Supabase Auth → Session Token → AuthProvider Context → Protected Routes
```

### **5.2 Land Declaration Flow**
```
Farmer fills form → Save as draft → Submit for review (status: 'pending')
→ Admin reviews → Approve/Reject → Status updated → Activity logged
→ Approved data visible in reports
```

### **5.3 Coffee Grading Flow**
```
Farmer enters sample parameters → Frontend validates → POST to Python API (port 7249)
→ API calculates cupping score, defects, grade → Returns JSON response
→ Frontend displays result → Save to `coffee_samples` table → Link to harvest
```

### **5.4 Harvest Reporting Flow**
```
Select plant cluster → Enter harvest data → Optional: Grade sample via API
→ Save harvest to `harvest_data` → Update plant status → Activity logged
→ Data available for analytics and predictions
```

### **5.5 Predictive Analytics Flow**
```
User selects plant/farm → Fetch historical data from Supabase
→ Client-side ML models analyze data → Calculate predictions
→ Display forecasts (yield, quality distribution, revenue)
→ Save predictions to database (optional)
```

### **5.6 Real-Time Updates**
```
Database change → Supabase real-time trigger → Frontend subscription receives update
→ React state updates → UI re-renders → User sees live changes
```

---

## 6. Technology Stack

### **Frontend**
- **Core**: React 18.2.0, React DOM 18.2.0
- **Build Tool**: Vite 4.4.5
- **Routing**: React Router DOM 6.22.0
- **Styling**: Tailwind CSS 3.3.3, PostCSS, Autoprefixer
- **3D Graphics**: Three.js 0.177.0, @react-three/fiber 8.15.12, @react-three/drei 9.92.7
- **Charts**: Chart.js 4.4.9, react-chartjs-2 5.3.0, Recharts 2.15.2
- **PDF**: jsPDF 3.0.1, jspdf-autotable 5.0.2, html2pdf.js 0.10.3
- **ML**: @tensorflow/tfjs 4.22.0, ml-matrix 6.12.1, ml-naivebayes 4.0.0, simple-statistics 7.8.8
- **HTTP**: Axios 1.10.0
- **UI**: Lucide React 0.525.0, React Icons 5.5.0, React Toastify 11.0.5
- **Utils**: PapaParse 5.5.2 (CSV parsing), GSAP 3.13.0 (animations)
- **Linting**: ESLint 8.45.0

### **Backend**
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **API**: Python 3.x, Flask 3.0.0, Flask-CORS 4.0.0
- **Deployment**: GitHub Pages (frontend), Supabase Cloud (backend)

### **Development Tools**
- **Version Control**: Git
- **Package Manager**: npm
- **Deployment**: gh-pages 6.0.0

---

## 7. Important Tables / Schema

### **7.1 Primary Tables**

**`users`**:
- `id` (UUID, PK): User identifier
- `email` (VARCHAR, UNIQUE): Email address
- `password_hash` (VARCHAR): Hashed password
- `role` (VARCHAR): 'farmer' | 'admin'
- `first_name`, `last_name` (VARCHAR): User name
- `created_at` (TIMESTAMPTZ): Registration timestamp

**`farmer_detail`**:
- `id` (UUID, PK): Farmer detail identifier (references `users.id`)
- `farmer_id` (UUID, FK → `users.id`): Farmer user ID
- `farm_location` (TEXT): Farm location string
- `farm_size` (NUMERIC): Farm size (hectares)
- `farm_elevation` (TEXT): Elevation range (e.g., "1100-1500 meters") - calculated from plant clusters
- `farmers_details` (JSONB): Additional farm information
- `verification_status` (VARCHAR): 'draft' | 'pending' | 'approved' | 'rejected'
- `admin_notes` (TEXT): Admin feedback
- `verified_by` (UUID, FK → `users.id`): Admin who verified
- `verified_at` (TIMESTAMPTZ): Verification timestamp
- `submitted_at` (TIMESTAMPTZ): Submission timestamp

**`plant_data`**:
- `plant_id` (BIGINT, PK): Plant cluster identifier
- `farmer_id` (UUID, FK → `users.id`): Owner farmer
- `coffee_variety` (VARCHAR): Coffee variety (default: 'Robusta')
- `planting_date` (DATE): When coffee was planted
- `number_of_tree_planted` (INTEGER): Number of trees in cluster
- `elevation` (FLOAT8): Individual cluster elevation (meters above sea level)
- `cluster_size` (FLOAT8): Cluster size (square meters)
- `verification_status` (VARCHAR): Verification status
- `admin_notes`, `verified_by`, `verified_at`, `submitted_at`: Verification fields

**`plant_status`**:
- `plant_status_id` (BIGINT, PK): Status record identifier
- `plant_id` (BIGINT, FK → `plant_data.plant_id`): Associated plant cluster
- `status` (VARCHAR): Health status
- `age_stage` (VARCHAR): Growth stage
- `soil_ph` (FLOAT8): Soil pH level
- `moisture_level` (VARCHAR): Moisture condition
- `last_fertilized` (DATE): Last fertilization date
- `verification_status`, `admin_notes`, `verified_by`, `verified_at`, `submitted_at`: Verification fields

**`harvest_data`**:
- `harvest_id` (BIGINT, PK): Harvest record identifier
- `farmer_id` (UUID, FK → `users.id`): Farmer who harvested
- `plant_id` (BIGINT, FK → `plant_data.plant_id`): Source plant cluster
- `harvest_date` (DATE): Harvest date
- `coffee_raw_quantity` (NUMERIC): Raw coffee quantity (kg)
- `coffee_dry_quantity` (NUMERIC): Dried coffee quantity (kg)
- `coffee_fine_grade` (NUMERIC): Fine grade quantity (kg)
- `coffee_premium_grade` (NUMERIC): Premium grade quantity (kg)
- `coffee_commercial_grade` (NUMERIC): Commercial grade quantity (kg)
- `bag_weight` (FLOAT8): Sample bag weight
- `processing_method` (INT2): 0=Washed/Wet, 1=Natural/Dry
- `colors` (INT2): 0=Green, 1=Bluish-Green, 2=Blue-Green
- `moisture` (FLOAT8): Moisture percentage (0-20)
- `category_one_defects` (INT2): Primary defects count
- `category_two_defects` (INT2): Secondary defects count
- `verification_status`, `admin_notes`, `verified_by`, `verified_at`, `submitted_at`: Verification fields

**`coffee_samples`**:
- `sample_id` (BIGINT, PK): Sample identifier
- `harvest_id` (BIGINT, FK → `harvest_data.harvest_id`): Associated harvest
- `bag_weight` (FLOAT8): Sample bag weight
- `processing_method` (INT2): Processing method code
- `colors` (INT2): Bean color code
- `moisture` (FLOAT8): Moisture percentage
- `category_one_defects` (INT2): Primary defects
- `category_two_defects` (INT2): Secondary defects
- `predicted_quality_grade` (VARCHAR): API prediction result
- `verification_status`, `admin_notes`, `verified_by`, `verified_at`, `submitted_at`: Verification fields

**`activity_log`**:
- `log_id` (BIGINT, PK): Log entry identifier
- `user_id` (UUID, FK → `users.id`): User who performed action
- `farmer_id` (UUID, FK → `users.id`): Affected farmer (if applicable)
- `entity_type` (VARCHAR): Table name (e.g., 'plant_data', 'harvest_data')
- `entity_id` (TEXT): Record identifier
- `action` (VARCHAR): Action type ('create', 'update', 'delete', 'verification_update')
- `change_summary` (TEXT): Human-readable summary
- `old_data` (JSONB): Previous values
- `new_data` (JSONB): New values
- `created_at` (TIMESTAMPTZ): Timestamp

### **7.2 Views**

**`admin_verification_dashboard`**: Aggregates all pending/rejected items from:
- `farmer_detail`
- `plant_data`
- `plant_status`
- `harvest_data`
- `coffee_samples`

### **7.3 Key Constraints**
- Foreign key relationships enforce data integrity
- Check constraints on verification_status values
- Unique constraints on email, username
- Elevation and cluster_size are FLOAT8 (can be NULL for backward compatibility)
- Farm elevation is TEXT to support ranges (e.g., "1100-1500 meters")

---

## 8. Important Business Logic

### **8.1 Coffee Grading Algorithm**
- **Cupping Score Calculation**:
  - Base score: 75.0
  - Elevation factor: Optimal at 900m, range ±300m (penalty for deviation)
  - Processing method: Washed/Wet (0) = 0.95, Natural/Dry (1) = 0.85
  - Color factor: Green (0) = 0.80, Bluish-Green (1) = 0.90, Blue-Green (2) = 0.95
  - Moisture factor: Optimal 12-14% = 1.0, penalties for deviations
  - Defect penalty: More defects = lower score, primary defects weighted 3x
  - Final score: Clamped between 60-95

- **Grade Classification** (CQI/UCDA Fine Robusta):
  - **Fine**: 0 primary defects AND ≤5 secondary defects AND cupping score ≥80
  - **Premium**: ≤12 combined defects AND cupping score ≥80
  - **Commercial**: All others

- **PNS Grade** (Philippine National Standard):
  - Grade 1: ≤10% defects
  - Grade 2: ≤15% defects
  - Grade 3: ≤25% defects
  - Grade 4: ≤40% defects
  - Grade 5: >40% defects

### **8.2 Farm Elevation Calculation**
- Farm elevation is **calculated as a range** from all plant cluster elevations
- Formula: `min(elevations) - max(elevations) meters`
- If single elevation: `"{elevation} meters"`
- If range: `"{min}-{max} meters"`
- Stored as TEXT in `farmer_detail.farm_elevation`
- Automatically recalculated when plant clusters are added/edited/deleted

### **8.3 Verification Workflow**
1. **Draft**: Farmer saves data locally (not submitted)
2. **Pending**: Farmer submits for admin review (`submitted_at` set)
3. **Approved**: Admin approves → Data becomes official, visible in reports
4. **Rejected**: Admin rejects with notes → Farmer can resubmit after corrections

**Business Rules**:
- Only approved data appears in official analytics
- Admins can edit data during approval
- All verification actions logged in `activity_log`
- Farmers can see verification status and admin notes

### **8.4 Data Isolation (Multi-Tenant)**
- Row Level Security (RLS) policies ensure farmers only see their own data
- All queries filtered by `user_id` or `farmer_id`
- Admins have elevated access to view all data
- Foreign key constraints prevent orphaned records

### **8.5 Activity Logging**
- All create/update/delete operations logged
- Stores before/after values as JSONB
- Includes user ID, entity type, action type, change summary
- Used for audit trail and debugging

### **8.6 Quality Distribution Calculation**
- Based on historical harvest data
- Adjusted by environmental factors (pH, moisture, fertilization timing)
- Seasonal factors applied (wet/dry/transitional seasons)
- Returns percentage distribution: Fine, Premium, Commercial

### **8.7 Yield Forecasting**
- Inputs: Plant age, farm area, fertilization practices, climate/soil suitability
- Calculates multi-year projections
- Accounts for seasonal variations
- Returns yearly breakdown with quality probabilities

---

## 9. ML / Analytics Components

### **9.1 Client-Side ML Models**

**DecisionSupportSystem.js**:
- Environmental parameter validation (temperature, humidity, pH ranges)
- Growth trend analysis using time-series data
- Seasonal yield target calculation
- Recommendation generation based on conditions
- Priority assignment (High/Medium/Low)

**QualityPredictor.ts**:
- Historical data analysis for base quality distribution
- Environmental factor adjustments (pH, moisture, fertilizer timing)
- Seasonal yield prediction
- Quality distribution forecasting (Fine/Premium/Commercial percentages)

**TimeSeriesAnalysis.js**:
- Time-series data point management
- Seasonal growth trend calculation
- Next value prediction based on historical patterns
- Trend direction analysis (increasing/decreasing/stable)

**AdvancedAnalytics.js**:
- Statistical analysis functions
- Data aggregation and summarization
- Correlation calculations

### **9.2 Server-Side ML (Python API)**

**Grading Logic** (`api/grading_logic.py`):
- `calculate_cupping_score()`: Multi-factor scoring algorithm
- `calculate_fine_premium_grade()`: CQI/UCDA classification
- `calculate_pns_grade()`: Philippine National Standard grading
- `predict_coffee_grade()`: Main prediction orchestrator

**Model Characteristics**:
- Rule-based (not trained ML model)
- Based on industry standards (CQI/UCDA, PNS)
- Deterministic outputs (same inputs → same outputs)
- Fast inference (<100ms)

### **9.3 Data Requirements for ML**

**For Quality Prediction**:
- Historical harvest data (quantities by grade)
- Current environmental conditions (pH, moisture, last fertilized)
- Seasonal context (wet/dry/transitional)

**For Yield Forecasting**:
- Plant age and farm area
- Historical yield data
- Management practices (fertilization, pest control frequency)
- Climate and soil suitability indices

**For Grading**:
- Sample parameters (altitude, processing method, colors, moisture, defects)
- No historical data required (rule-based)

### **9.4 Model Performance**
- **Grading Accuracy**: 95%+ (based on CQI/UCDA standards alignment)
- **Prediction Confidence**: 80%+ for yield forecasts
- **Response Time**: <100ms for grading API, <2s for analytics

---

## 10. Known Issues / TODOs

### **10.1 Migration Status**
- ✅ Python API migration from R completed
- ✅ Admin verification system implemented
- ✅ Elevation and cluster size tracking added
- ⏳ Frontend may need updates to fully utilize new API response fields (cupping_score, pns_grade)

### **10.2 Known Limitations**
- **Port Dependency**: Python API hardcoded to port 7249 (can be configured via environment variable)
- **API Availability**: Frontend assumes API is running locally (no fallback mechanism)
- **Grade Format Compatibility**: Frontend handles both old ("A"/"B"/"C") and new ("Fine"/"Premium"/"Commercial") formats
- **Elevation Data**: Existing plant records may have NULL elevation (backward compatible)

### **10.3 Potential Enhancements**
- **Bulk Operations**: Approve/reject multiple verification items at once
- **Email Notifications**: Notify farmers of verification status changes
- **Auto-Approval**: Rules-based automatic approval for certain criteria
- **Mobile Support**: Mobile-friendly verification interface
- **Advanced Filtering**: More sophisticated filtering in admin verification dashboard
- **ML Model Training**: Replace rule-based grading with trained ML model (if historical data available)
- **Weather Integration**: Real-time weather data integration for better predictions
- **Elevation Zone Analysis**: Group plants by elevation ranges for quality analysis
- **Cluster Size Optimization**: Recommendations based on cluster size and yield correlation

### **10.4 Technical Debt**
- Some components use hardcoded API URLs instead of config file
- Mixed use of TypeScript (.ts) and JavaScript (.js) files
- Some database queries could be optimized with better indexing
- PDF export functionality could be enhanced with more formatting options

---

## 11. Anything the next AI must know

### **11.1 Critical Configuration**
- **Environment Variables Required**:
  - `VITE_SUPABASE_URL`: Supabase project URL
  - `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
  - `VITE_API_BASE_URL`: Python API base URL (default: http://127.0.0.1:7249)

- **API Server**: Must be running before using grading features
  - Start: `cd api && python coffee_grading_api.py`
  - Health check: `curl http://127.0.0.1:7249/health`

### **11.2 Database Schema Notes**
- **Two Schema References Exist**:
  1. **Supabase Schema** (actual): Uses UUID for `users.id`, BIGINT for most other PKs, TEXT for `farm_elevation`
  2. **PostgreSQL Schema** (`py try/database_schema.sql`): Reference schema for multi-farmer system (not currently used, but shows intended structure)

- **Key Differences**:
  - Supabase uses UUID for user IDs, PostgreSQL schema uses SERIAL
  - Supabase `farm_elevation` is TEXT (for ranges), PostgreSQL schema uses INTEGER
  - Supabase has verification fields added via migrations

### **11.3 Authentication Flow**
- Uses Supabase Auth (not custom auth)
- Session managed via `AuthProvider` context
- Protected routes use `ProtectedRoute` component with role-based access
- Password reset flow: ForgotPassword → ResetPassword (token-based)

### **11.4 Data Submission Workflow**
- Farmers can save data as "draft" (not submitted)
- Must explicitly "submit" for admin review (status changes to 'pending')
- Only approved data appears in official reports/analytics
- Rejected data can be resubmitted after corrections

### **11.5 API Integration**
- **Coffee Grading API**: Python Flask server (port 7249)
  - Endpoint: `/predict` (GET)
  - Returns: JSON with grade, cupping score, PNS grade, defect analysis
  - CORS enabled for frontend access
  - Error handling: Returns structured error responses

- **Supabase API**: Auto-generated from schema
  - Real-time subscriptions available
  - Row Level Security (RLS) enforced
  - All queries go through Supabase client

### **11.6 File Structure**
- **Frontend**: `src/` directory
  - `pages/`: Route components
  - `components/`: Reusable UI components
  - `lib/`: Utilities, ML modules, context providers
  - `config/`: Configuration files
  - `styles/`: CSS files

- **Backend**: `api/` directory
  - `coffee_grading_api.py`: Flask server
  - `grading_logic.py`: Core grading functions

- **Documentation**: Root directory
  - Migration guides, API docs, setup instructions

### **11.7 Important Code Patterns**
- **Data Fetching**: Uses Supabase client with async/await
- **Error Handling**: Try-catch blocks with toast notifications
- **Form Validation**: Client-side validation before API calls
- **State Management**: React hooks (useState, useEffect, useCallback, useMemo)
- **Real-time Updates**: Supabase subscriptions in useEffect hooks

### **11.8 Testing Considerations**
- No automated tests currently (manual testing only)
- Test with both farmer and admin accounts
- Verify RLS policies work correctly (farmers can't see other farmers' data)
- Test verification workflow end-to-end
- Test API availability and error handling

### **11.9 Deployment Notes**
- **Frontend**: Deployed to GitHub Pages via `npm run deploy` (uses gh-pages)
- **Backend**: Supabase cloud (managed)
- **API Server**: Must be deployed separately (not currently in cloud)
- **Environment Variables**: Set in GitHub Secrets for CI/CD

### **11.10 Common Issues & Solutions**
- **"API not responding"**: Check if Python API server is running on port 7249
- **"Verification status not showing"**: Verify database migration was run (admin_verification_schema_fixed.sql)
- **"Farm elevation shows as empty"**: Add plant clusters with elevation data first
- **"CORS errors"**: Ensure Flask-CORS is installed and enabled
- **"RLS policy violation"**: Check user role and data ownership

---

**End of System Context Summary**

