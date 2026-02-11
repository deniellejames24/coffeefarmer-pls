# Database Setup Summary
## Quick Start Guide for Multi-Farmer Account Support

---

## 📦 Files Created

1. **`database_schema.sql`** - Complete PostgreSQL database schema
2. **`DATABASE_SCHEMA_DOCUMENTATION.md`** - Detailed documentation
3. **`database_integration_example.py`** - Python integration examples

---

## 🚀 Quick Setup Steps

### Step 1: Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# Windows: Download from https://www.postgresql.org/download/windows/
```

### Step 2: Create Database

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE robusta_coffee_db;
CREATE USER coffee_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE robusta_coffee_db TO coffee_user;

# Exit psql
\q
```

### Step 3: Run Schema Script

```bash
psql -U coffee_user -d robusta_coffee_db -f database_schema.sql
```

### Step 4: Install Python Dependencies

```bash
pip install psycopg2-binary bcrypt streamlit
```

### Step 5: Configure Streamlit Secrets

Create `.streamlit/secrets.toml`:

```toml
[DB]
DB_HOST = "localhost"
DB_NAME = "robusta_coffee_db"
DB_USER = "coffee_user"
DB_PASSWORD = "your_secure_password"
DB_PORT = 5432
```

---

## 📊 Database Structure Overview

### Core Tables (13 tables)

1. **users** - Farmer accounts
2. **farms** - Farm locations and info
3. **coffee_lots** - Subdivisions within farms
4. **plant_measurements** - Plant growth tracking
5. **environmental_data** - Monthly environmental records
6. **management_practices** - Fertilization, pest control, etc.
7. **harvests** - Harvest records
8. **grade_assessments** - Coffee quality grading
9. **predictions** - ML model predictions
10. **yield_forecasts** - Multi-year forecasts
11. **recommendations** - Actionable recommendations
12. **analytics_cache** - Performance optimization
13. **audit_log** - Change tracking

### Key Features

✅ **Multi-tenant**: Each farmer has isolated data  
✅ **Time-series**: Historical tracking of all data  
✅ **Flexible**: JSONB fields for extensible data  
✅ **Audit trail**: Complete change tracking  
✅ **Performance**: Indexes and caching support  

---

## 🔑 Key Relationships

```
User (1) → (N) Farms
Farm (1) → (N) Coffee Lots
Coffee Lot (1) → (N) Harvests
Harvest (1) → (1) Grade Assessment
User (1) → (N) Predictions
User (1) → (N) Yield Forecasts
```

---

## 💻 Integration with Streamlit App

### 1. Add Authentication

Replace the CSV loading with database queries:

```python
# Before (CSV)
df = pd.read_csv('robusta_coffee_dataset.csv')

# After (Database)
from database_integration_example import get_user_harvests, get_dashboard_summary

user_id = st.session_state.user_id
harvests = get_user_harvests(user_id)
df = pd.DataFrame(harvests)
```

### 2. Update Data Loading

In `engineer_features()` function, load from database:

```python
def load_user_data(user_id):
    """Load data for specific user from database"""
    conn = get_db_connection()
    # Query grade assessments with all related data
    query = """
        SELECT 
            ga.*, h.harvest_date, cl.lot_name, f.farm_name,
            f.elevation_masl, ed.monthly_temp_avg_c,
            ed.monthly_rainfall_mm, ed.soil_pH, ed.soil_moisture_pct
        FROM grade_assessments ga
        JOIN harvests h ON ga.harvest_id = h.harvest_id
        JOIN coffee_lots cl ON h.lot_id = cl.lot_id
        JOIN farms f ON cl.farm_id = f.farm_id
        LEFT JOIN environmental_data ed ON f.farm_id = ed.farm_id
        WHERE f.user_id = %s
    """
    df = pd.read_sql(query, conn, params=(user_id,))
    conn.close()
    return df
```

### 3. Save Predictions

After generating predictions, save them:

```python
# In Grade Prediction Tool page
if st.button("🔮 Predict Coffee Grade"):
    # ... prediction logic ...
    
    # Save to database
    prediction_data = {
        'farm_id': selected_farm_id,
        'lot_id': selected_lot_id,
        'prediction_type': 'grade_prediction',
        'input_parameters': {
            'plant_age': plant_age,
            'bean_screen': bean_screen,
            'primary_defects': primary_defects,
            # ... all inputs
        },
        'predicted_grade': predicted_grade,
        'predicted_pns_grade': pns_grade,
        'predicted_cupping_score': cupping_score,
        'confidence_score': 0.85
    }
    
    save_prediction(st.session_state.user_id, prediction_data)
```

### 4. Save Grade Assessments

When user submits a grade assessment:

```python
# After grade assessment
assessment_data = {
    'harvest_id': harvest_id,
    'primary_defects': primary_defects,
    'secondary_defects': secondary_defects,
    'total_defect_pct': total_defect_pct,
    'coffee_grade': predicted_grade,
    'pns_grade': pns_grade,
    'cupping_score': cupping_score,
    # ... all calculated values
}

save_grade_assessment(harvest_id, assessment_data)
```

---

## 📝 Sample Data Migration

If you have existing CSV data, create a migration script:

```python
import pandas as pd
from database_integration_example import get_db_connection

def migrate_csv_to_db(csv_file, user_id):
    """Migrate CSV data to database"""
    df = pd.read_csv(csv_file)
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Create a default farm for this user
    cur.execute("""
        INSERT INTO farms (user_id, farm_name, total_area_hectares, elevation_masl)
        VALUES (%s, %s, %s, %s)
        RETURNING farm_id
    """, (user_id, "Default Farm", 1.0, 900))
    farm_id = cur.fetchone()[0]
    
    # Create a default lot
    cur.execute("""
        INSERT INTO coffee_lots (farm_id, lot_name, area_hectares, variety)
        VALUES (%s, %s, %s, %s)
        RETURNING lot_id
    """, (farm_id, "Default Lot", 1.0, "Robusta"))
    lot_id = cur.fetchone()[0]
    
    # Migrate each row as a harvest and assessment
    for idx, row in df.iterrows():
        # Create harvest
        cur.execute("""
            INSERT INTO harvests (lot_id, harvest_date, green_beans_kg)
            VALUES (%s, %s, %s)
            RETURNING harvest_id
        """, (lot_id, f"2024-01-{idx+1:02d}", 100))
        harvest_id = cur.fetchone()[0]
        
        # Create assessment
        cur.execute("""
            INSERT INTO grade_assessments (
                harvest_id, primary_defects, secondary_defects,
                total_defect_pct, coffee_grade, pns_grade, cupping_score
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            harvest_id,
            row.get('primary_defects', 0),
            row.get('secondary_defects', 0),
            row.get('total_defect_pct', 0),
            row.get('coffee_grade', 'Commercial'),
            row.get('pns_grade', 3),
            row.get('cupping_score', 75)
        ))
    
    conn.commit()
    cur.close()
    conn.close()
    print("Migration complete!")
```

---

## 🔒 Security Best Practices

1. **Password Hashing**: Always use bcrypt (included in examples)
2. **SQL Injection**: Use parameterized queries (all examples use this)
3. **Access Control**: Filter all queries by `user_id`
4. **Connection Security**: Use SSL for production
5. **Secrets Management**: Store credentials in Streamlit secrets
6. **Input Validation**: Validate all user inputs
7. **Rate Limiting**: Implement rate limiting for API endpoints

---

## 📈 Performance Optimization

### 1. Use Indexes
All foreign keys and common query fields are indexed.

### 2. Connection Pooling
For production, use connection pooling:

```python
from psycopg2 import pool

connection_pool = psycopg2.pool.SimpleConnectionPool(
    1, 20,
    host=st.secrets["DB_HOST"],
    database=st.secrets["DB_NAME"],
    user=st.secrets["DB_USER"],
    password=st.secrets["DB_PASSWORD"]
)
```

### 3. Caching
Use `analytics_cache` table for expensive queries.

### 4. Materialized Views
Refresh materialized views periodically for dashboard summaries.

---

## 🧪 Testing

### Test Database Connection

```python
from database_integration_example import get_db_connection

conn = get_db_connection()
if conn:
    st.success("Database connected!")
    conn.close()
else:
    st.error("Database connection failed!")
```

### Test User Creation

```python
from database_integration_example import register_user

try:
    user = register_user("testuser", "test@example.com", "password123", "Test User")
    st.success(f"User created: {user['username']}")
except ValueError as e:
    st.error(str(e))
```

---

## 📚 Next Steps

1. ✅ Run `database_schema.sql` to create tables
2. ✅ Set up Streamlit secrets
3. ✅ Integrate authentication into your app
4. ✅ Replace CSV loading with database queries
5. ✅ Add user registration/login pages
6. ✅ Implement data entry forms for harvests/assessments
7. ✅ Add farm/lot management pages
8. ✅ Test with sample data
9. ✅ Deploy to production

---

## 🆘 Troubleshooting

### Connection Errors
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify credentials in `.streamlit/secrets.toml`
- Check firewall settings

### Permission Errors
- Ensure user has proper permissions: `GRANT ALL PRIVILEGES ON DATABASE robusta_coffee_db TO coffee_user;`
- Grant schema permissions: `GRANT ALL ON SCHEMA public TO coffee_user;`

### Import Errors
- Install dependencies: `pip install psycopg2-binary bcrypt`
- Check Python version (3.8+)

---

## 📞 Support

For questions or issues:
1. Check `DATABASE_SCHEMA_DOCUMENTATION.md` for detailed explanations
2. Review `database_integration_example.py` for code examples
3. Check PostgreSQL logs: `/var/log/postgresql/`

---

**Ready to integrate!** 🚀

