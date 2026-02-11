# Database Schema Documentation
## Robusta Coffee Dashboard - Multi-Farmer Account Support

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Architecture](#database-architecture)
3. [Table Descriptions](#table-descriptions)
4. [Entity Relationships](#entity-relationships)
5. [Key Features](#key-features)
6. [Integration Guide](#integration-guide)
7. [Sample Queries](#sample-queries)

---

## 🎯 Overview

This database schema supports a multi-tenant system where multiple farmers can:
- Manage multiple farms and coffee lots
- Record harvests and grade assessments
- Store environmental and management data
- Generate predictions and forecasts
- Track recommendations and improvements

### Database Requirements
- **PostgreSQL 12+** (recommended) or **MySQL 8+**
- Supports JSON/JSONB for flexible data storage
- Full ACID compliance
- Foreign key constraints for data integrity

---

## 🏗️ Database Architecture

### Core Entities

```
Users (Farmers)
    ↓
Farms (Multiple per farmer)
    ↓
Coffee Lots (Subdivisions within farms)
    ↓
├── Plant Measurements
├── Environmental Data
├── Management Practices
├── Harvests
│   └── Grade Assessments
├── Predictions
├── Yield Forecasts
└── Recommendations
```

---

## 📊 Table Descriptions

### 1. **users** - Farmer Accounts
**Purpose:** Store farmer account information

**Key Fields:**
- `user_id` - Primary key
- `username` - Unique login identifier
- `email` - Unique email address
- `password_hash` - Hashed password (use bcrypt/argon2)
- `full_name` - Farmer's full name
- `user_role` - 'farmer', 'admin', 'analyst'
- `is_active` - Account status

**Relationships:**
- One-to-Many with `farms`
- One-to-Many with `predictions`
- One-to-Many with `yield_forecasts`

---

### 2. **farms** - Farm Information
**Purpose:** Store farm location and basic information

**Key Fields:**
- `farm_id` - Primary key
- `user_id` - Foreign key to `users`
- `farm_name` - Name of the farm
- `location_province`, `location_municipality`, `location_barangay` - Location
- `location_coordinates` - PostgreSQL POINT type (lat/long)
- `total_area_hectares` - Total farm area
- `elevation_masl` - Elevation in meters above sea level

**Relationships:**
- Many-to-One with `users`
- One-to-Many with `coffee_lots`
- One-to-Many with `environmental_data`

---

### 3. **coffee_lots** - Coffee Plots/Lots
**Purpose:** Subdivisions within farms (different planting dates, varieties, etc.)

**Key Fields:**
- `lot_id` - Primary key
- `farm_id` - Foreign key to `farms`
- `lot_name` - Name/number of the lot
- `area_hectares` - Area of this specific lot
- `planting_date` - When coffee was planted
- `variety` - Coffee variety (default: 'Robusta')
- `total_plants` - Number of coffee plants

**Relationships:**
- Many-to-One with `farms`
- One-to-Many with `plant_measurements`
- One-to-Many with `management_practices`
- One-to-Many with `harvests`

---

### 4. **plant_measurements** - Plant Characteristics
**Purpose:** Track plant growth and health over time

**Key Fields:**
- `measurement_id` - Primary key
- `lot_id` - Foreign key to `coffee_lots`
- `measurement_date` - When measurement was taken
- `plant_age_months` - Age of plants
- `plant_height_cm` - Average plant height
- `trunk_diameter_cm` - Average trunk diameter
- `environmental_stress_index` - Calculated stress (0.0-1.0)

**Use Case:** Track plant development, calculate bean screen size

---

### 5. **environmental_data** - Time-Series Environmental Data
**Purpose:** Store monthly environmental conditions per farm

**Key Fields:**
- `env_id` - Primary key
- `farm_id` - Foreign key to `farms`
- `record_date` - Date of record (monthly)
- `monthly_temp_avg_c` - Average temperature
- `monthly_rainfall_mm` - Total rainfall
- `soil_pH` - Soil pH level
- `soil_moisture_pct` - Soil moisture percentage
- `relative_humidity_pct` - Humidity level

**Unique Constraint:** One record per farm per date

**Use Case:** Calculate climate suitability, feed into predictions

---

### 6. **management_practices** - Farm Management Activities
**Purpose:** Track fertilization, pest control, pruning, irrigation

**Key Fields:**
- `practice_id` - Primary key
- `lot_id` - Foreign key to `coffee_lots`
- `practice_date` - When practice was applied
- `practice_type` - Type: 'fertilization', 'pest_control', 'pruning', etc.
- `fertilization_type` - 'Organic' or 'Non-Organic'
- `fertilization_frequency` - 1-5 Likert scale
- `pest_management_frequency` - 1-5 Likert scale
- `cost_php` - Cost in Philippine Pesos

**Use Case:** Feed into yield forecasting, track management history

---

### 7. **harvests** - Harvest Records
**Purpose:** Record each harvest event

**Key Fields:**
- `harvest_id` - Primary key
- `lot_id` - Foreign key to `coffee_lots`
- `harvest_date` - Date of harvest
- `harvest_season` - 'Main', 'Off', 'Fly'
- `harvest_method` - 'Selective', 'Strip', 'Mechanical'
- `cherries_harvested_kg` - Weight of cherries
- `green_beans_kg` - Weight after processing
- `processing_method` - 'Wet', 'Dry', 'Honey', 'Natural'
- `moisture_content_pct` - Final moisture content

**Relationships:**
- Many-to-One with `coffee_lots`
- One-to-One with `grade_assessments`

---

### 8. **grade_assessments** - Coffee Quality Grading
**Purpose:** Store detailed grade assessment results

**Key Fields:**
- `assessment_id` - Primary key
- `harvest_id` - Foreign key to `harvests`
- `sample_weight_g` - Sample weight (default 350g)
- `primary_defects` - Category 1 defect count
- `secondary_defects` - Category 2 defect count
- `total_defect_pct` - Calculated defect percentage
- `bean_screen_size_mm` - Bean size measurement
- `bean_size_class` - 'Large', 'Medium', 'Small'
- `pns_grade` - PNS grade (1-5)
- `coffee_grade` - 'Fine', 'Premium', 'Commercial'
- `cupping_score` - Cupping score (0-100)
- `overall_quality_index` - Calculated quality index
- `defect_details` - JSONB for detailed defect breakdown

**Use Case:** Core grading data, feed into analytics and predictions

---

### 9. **predictions** - Grade Predictions
**Purpose:** Store ML model predictions for grade classification

**Key Fields:**
- `prediction_id` - Primary key
- `user_id` - Foreign key to `users`
- `farm_id`, `lot_id` - Optional links
- `prediction_type` - 'grade_prediction', 'defect_prediction'
- `input_parameters` - JSONB storing all inputs
- `predicted_grade` - Model prediction
- `predicted_pns_grade` - Predicted PNS grade
- `predicted_cupping_score` - Predicted cupping score
- `confidence_score` - Model confidence (0.0-1.0)
- `model_name` - Which model was used
- `model_version` - Model version

**Use Case:** Track prediction history, compare with actual results

---

### 10. **yield_forecasts** - Multi-Year Yield Forecasts
**Purpose:** Store yield and grade distribution forecasts

**Key Fields:**
- `forecast_id` - Primary key
- `user_id` - Foreign key to `users`
- `farm_id`, `lot_id` - Optional links
- `forecast_period_years` - Number of years forecasted
- `base_year` - Starting year
- `fertilization_type` - Input parameter
- `fertilization_frequency` - Input parameter (1-5)
- `pest_management_frequency` - Input parameter (1-5)
- `forecast_data` - JSONB array of yearly forecasts
- `total_yield_kg` - Total projected yield
- `avg_yield_per_year_kg_ha` - Average yield per hectare
- `avg_fine_probability` - Average Fine grade probability

**Forecast Data Structure (JSONB):**
```json
[
  {
    "year": 1,
    "age_months": 60,
    "yield_kg_ha": 1200.5,
    "total_yield_kg": 1200.5,
    "fine_probability": 0.6,
    "premium_probability": 0.35,
    "commercial_probability": 0.05
  },
  ...
]
```

---

### 11. **recommendations** - Actionable Recommendations
**Purpose:** Store system-generated recommendations for farmers

**Key Fields:**
- `recommendation_id` - Primary key
- `user_id` - Foreign key to `users`
- `recommendation_type` - 'yield_optimization', 'quality_improvement', etc.
- `priority` - 'High', 'Medium', 'Low'
- `title` - Recommendation title
- `description` - Detailed description
- `action_items` - JSON array of specific actions
- `status` - 'Pending', 'In Progress', 'Completed', 'Dismissed'
- `due_date` - Optional deadline

**Use Case:** Track farmer actions, measure improvement

---

### 12. **analytics_cache** - Performance Optimization
**Purpose:** Cache expensive analytics queries

**Key Fields:**
- `cache_id` - Primary key
- `user_id` - Foreign key to `users`
- `cache_type` - Type of cached data
- `cache_key` - Unique identifier
- `cache_data` - JSONB with cached results
- `expires_at` - When cache expires

**Use Case:** Speed up dashboard loading, reduce database load

---

### 13. **audit_log** - Change Tracking
**Purpose:** Audit trail for all changes

**Key Fields:**
- `log_id` - Primary key
- `user_id` - Who made the change
- `action_type` - 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
- `table_name` - Which table was affected
- `record_id` - Which record was affected
- `old_values` - JSONB of old values
- `new_values` - JSONB of new values
- `ip_address` - User's IP address

**Use Case:** Security, compliance, debugging

---

## 🔗 Entity Relationships

### Primary Relationships

```
users (1) ──→ (N) farms
farms (1) ──→ (N) coffee_lots
farms (1) ──→ (N) environmental_data
coffee_lots (1) ──→ (N) plant_measurements
coffee_lots (1) ──→ (N) management_practices
coffee_lots (1) ──→ (N) harvests
harvests (1) ──→ (1) grade_assessments
users (1) ──→ (N) predictions
users (1) ──→ (N) yield_forecasts
users (1) ──→ (N) recommendations
```

### Relationship Diagram

```
┌─────────┐
│  users  │
└────┬────┘
     │
     ├───┐
     │   │
┌────▼───▼────┐      ┌──────────────┐
│    farms    │─────▶│ environmental│
└────┬────────┘      │    _data     │
     │               └──────────────┘
     │
┌────▼──────────┐
│ coffee_lots   │
└────┬──────────┘
     │
     ├───▶ plant_measurements
     ├───▶ management_practices
     └───▶ harvests ──▶ grade_assessments

users ──▶ predictions
users ──▶ yield_forecasts
users ──▶ recommendations
```

---

## ✨ Key Features

### 1. **Multi-Tenant Support**
- Each farmer has isolated data
- Foreign keys ensure data integrity
- User-based filtering in all queries

### 2. **Flexible Data Storage**
- JSONB fields for flexible data (defect_details, input_parameters, forecast_data)
- Allows schema evolution without migrations
- Easy to query with PostgreSQL JSONB operators

### 3. **Time-Series Data**
- Environmental data stored monthly
- Plant measurements tracked over time
- Historical harvest records

### 4. **Audit Trail**
- Audit log table tracks all changes
- IP address and user agent logging
- Before/after value tracking

### 5. **Performance Optimization**
- Indexes on foreign keys and common query fields
- Analytics cache for expensive queries
- Materialized views for dashboard summaries

### 6. **Data Integrity**
- Foreign key constraints
- Unique constraints where needed
- Check constraints (can be added)
- Triggers for automatic timestamp updates

---

## 🔌 Integration Guide

### Step 1: Install Database Driver

```python
# For PostgreSQL
pip install psycopg2-binary
# or
pip install asyncpg  # for async operations

# For MySQL
pip install mysql-connector-python
# or
pip install pymysql
```

### Step 2: Database Connection

```python
import psycopg2
from psycopg2.extras import RealDictCursor
import streamlit as st

@st.cache_resource
def get_db_connection():
    """Create database connection"""
    return psycopg2.connect(
        host=st.secrets["DB_HOST"],
        database=st.secrets["DB_NAME"],
        user=st.secrets["DB_USER"],
        password=st.secrets["DB_PASSWORD"],
        port=st.secrets.get("DB_PORT", 5432)
    )
```

### Step 3: User Authentication

```python
import bcrypt
from datetime import datetime

def hash_password(password):
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def authenticate_user(username, password):
    """Authenticate user and return user_id"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT user_id, username, password_hash, full_name, is_active
        FROM users
        WHERE username = %s AND is_active = TRUE
    """, (username,))
    
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if user and verify_password(password, user['password_hash']):
        # Update last login
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE users SET last_login = %s WHERE user_id = %s
        """, (datetime.now(), user['user_id']))
        conn.commit()
        cur.close()
        conn.close()
        return user
    
    return None
```

### Step 4: Session Management

```python
# In your Streamlit app
if 'user_id' not in st.session_state:
    st.session_state.user_id = None
    st.session_state.username = None
    st.session_state.full_name = None

def login_page():
    """Login page"""
    st.title("Login")
    username = st.text_input("Username")
    password = st.text_input("Password", type="password")
    
    if st.button("Login"):
        user = authenticate_user(username, password)
        if user:
            st.session_state.user_id = user['user_id']
            st.session_state.username = user['username']
            st.session_state.full_name = user['full_name']
            st.success(f"Welcome, {user['full_name']}!")
            st.rerun()
        else:
            st.error("Invalid credentials")
```

### Step 5: Data Filtering by User

```python
def get_user_farms(user_id):
    """Get all farms for a user"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT farm_id, farm_name, total_area_hectares, elevation_masl
        FROM farms
        WHERE user_id = %s AND is_active = TRUE
        ORDER BY farm_name
    """, (user_id,))
    
    farms = cur.fetchall()
    cur.close()
    conn.close()
    return farms
```

### Step 6: Save Grade Assessment

```python
def save_grade_assessment(harvest_id, assessment_data):
    """Save grade assessment to database"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        INSERT INTO grade_assessments (
            harvest_id, assessment_date, sample_weight_g,
            primary_defects, secondary_defects, total_defect_count,
            total_defect_pct, bean_screen_size_mm, bean_size_class,
            pns_grade, coffee_grade, cupping_score,
            climate_suitability_robusta, soil_suitability_robusta,
            overall_quality_index, defect_details, assessed_by
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        RETURNING assessment_id
    """, (
        harvest_id,
        assessment_data['assessment_date'],
        assessment_data.get('sample_weight_g', 350.0),
        assessment_data['primary_defects'],
        assessment_data['secondary_defects'],
        assessment_data['total_defect_count'],
        assessment_data['total_defect_pct'],
        assessment_data['bean_screen_size_mm'],
        assessment_data['bean_size_class'],
        assessment_data['pns_grade'],
        assessment_data['coffee_grade'],
        assessment_data['cupping_score'],
        assessment_data['climate_suitability_robusta'],
        assessment_data['soil_suitability_robusta'],
        assessment_data['overall_quality_index'],
        json.dumps(assessment_data.get('defect_details', {})),
        st.session_state.user_id
    ))
    
    assessment_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return assessment_id
```

### Step 7: Save Prediction

```python
def save_prediction(user_id, prediction_data):
    """Save prediction to database"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        INSERT INTO predictions (
            user_id, farm_id, lot_id, prediction_type,
            input_parameters, predicted_grade, predicted_pns_grade,
            predicted_defect_pct, predicted_cupping_score,
            confidence_score, model_name, model_version
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        RETURNING prediction_id
    """, (
        user_id,
        prediction_data.get('farm_id'),
        prediction_data.get('lot_id'),
        prediction_data['prediction_type'],
        json.dumps(prediction_data['input_parameters']),
        prediction_data['predicted_grade'],
        prediction_data['predicted_pns_grade'],
        prediction_data['predicted_defect_pct'],
        prediction_data['predicted_cupping_score'],
        prediction_data.get('confidence_score', 0.0),
        prediction_data.get('model_name', 'RandomForest'),
        prediction_data.get('model_version', '1.0')
    ))
    
    prediction_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return prediction_id
```

---

## 📝 Sample Queries

### Get Farmer Dashboard Data

```sql
SELECT 
    COUNT(DISTINCT f.farm_id) as total_farms,
    COUNT(DISTINCT h.harvest_id) as total_harvests,
    SUM(h.green_beans_kg) as total_production_kg,
    AVG(ga.cupping_score) as avg_cupping_score
FROM users u
LEFT JOIN farms f ON u.user_id = f.user_id
LEFT JOIN coffee_lots cl ON f.farm_id = cl.farm_id
LEFT JOIN harvests h ON cl.lot_id = h.lot_id
LEFT JOIN grade_assessments ga ON h.harvest_id = ga.harvest_id
WHERE u.user_id = %s;
```

### Get Recent Harvests with Grades

```sql
SELECT 
    h.harvest_date,
    f.farm_name,
    cl.lot_name,
    h.green_beans_kg,
    ga.coffee_grade,
    ga.pns_grade,
    ga.cupping_score,
    ga.total_defect_pct
FROM harvests h
JOIN coffee_lots cl ON h.lot_id = cl.lot_id
JOIN farms f ON cl.farm_id = f.farm_id
LEFT JOIN grade_assessments ga ON h.harvest_id = ga.harvest_id
WHERE f.user_id = %s
ORDER BY h.harvest_date DESC
LIMIT 10;
```

### Get Environmental Data for Farm

```sql
SELECT 
    record_date,
    monthly_temp_avg_c,
    monthly_rainfall_mm,
    soil_pH,
    soil_moisture_pct
FROM environmental_data
WHERE farm_id = %s
ORDER BY record_date DESC
LIMIT 12;  -- Last 12 months
```

### Get Grade Distribution

```sql
SELECT 
    coffee_grade,
    COUNT(*) as count,
    AVG(cupping_score) as avg_cupping,
    AVG(total_defect_pct) as avg_defects
FROM grade_assessments ga
JOIN harvests h ON ga.harvest_id = h.harvest_id
JOIN coffee_lots cl ON h.lot_id = cl.lot_id
JOIN farms f ON cl.farm_id = f.farm_id
WHERE f.user_id = %s
GROUP BY coffee_grade;
```

---

## 🔒 Security Considerations

1. **Password Hashing**: Always use bcrypt or argon2
2. **SQL Injection**: Use parameterized queries (shown in examples)
3. **Access Control**: Filter all queries by `user_id`
4. **Input Validation**: Validate all user inputs
5. **Connection Pooling**: Use connection pooling for production
6. **Encryption**: Encrypt sensitive data at rest
7. **Backup**: Regular database backups

---

## 🚀 Next Steps

1. **Create Database**: Run `database_schema.sql` to create tables
2. **Set Up Authentication**: Implement login/logout
3. **Migrate Existing Data**: If you have CSV data, create migration script
4. **Update Streamlit App**: Replace CSV loading with database queries
5. **Add User Management**: Registration, profile management
6. **Implement Caching**: Use `analytics_cache` for performance
7. **Add Audit Logging**: Track all user actions

---

## 📚 Additional Resources

- PostgreSQL JSONB Documentation: https://www.postgresql.org/docs/current/datatype-json.html
- psycopg2 Documentation: https://www.psycopg.org/docs/
- Streamlit Secrets: https://docs.streamlit.io/library/advanced-features/secrets-management

