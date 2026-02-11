"""
Database Integration Example for Robusta Coffee Dashboard
This file shows how to integrate the database schema with the Streamlit app
"""

import streamlit as st
import psycopg2
from psycopg2.extras import RealDictCursor
import json
import bcrypt
from datetime import datetime, date
import pandas as pd

# =====================================================
# DATABASE CONNECTION
# =====================================================

@st.cache_resource
def get_db_connection():
    """Create database connection - cached for performance"""
    try:
        conn = psycopg2.connect(
            host=st.secrets["DB_HOST"],
            database=st.secrets["DB_NAME"],
            user=st.secrets["DB_USER"],
            password=st.secrets["DB_PASSWORD"],
            port=st.secrets.get("DB_PORT", 5432)
        )
        return conn
    except Exception as e:
        st.error(f"Database connection error: {e}")
        return None

# =====================================================
# AUTHENTICATION FUNCTIONS
# =====================================================

def hash_password(password):
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed):
    """Verify password against hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except:
        return False

def authenticate_user(username, password):
    """Authenticate user and return user data"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT user_id, username, password_hash, full_name, email, is_active
            FROM users
            WHERE username = %s AND is_active = TRUE
        """, (username,))
        
        user = cur.fetchone()
        cur.close()
        
        if user and verify_password(password, user['password_hash']):
            # Update last login
            cur = conn.cursor()
            cur.execute("""
                UPDATE users SET last_login = %s WHERE user_id = %s
            """, (datetime.now(), user['user_id']))
            conn.commit()
            cur.close()
            conn.close()
            return dict(user)
        
        conn.close()
        return None
    except Exception as e:
        st.error(f"Authentication error: {e}")
        conn.close()
        return None

def register_user(username, email, password, full_name, phone_number=None):
    """Register a new user"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        password_hash = hash_password(password)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO users (username, email, password_hash, full_name, phone_number)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING user_id, username, full_name
        """, (username, email, password_hash, full_name, phone_number))
        
        user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {'user_id': user[0], 'username': user[1], 'full_name': user[2]}
    except psycopg2.IntegrityError as e:
        conn.rollback()
        conn.close()
        if 'username' in str(e):
            raise ValueError("Username already exists")
        elif 'email' in str(e):
            raise ValueError("Email already exists")
        raise ValueError("Registration failed")
    except Exception as e:
        conn.rollback()
        conn.close()
        raise ValueError(f"Registration error: {e}")

# =====================================================
# FARM MANAGEMENT FUNCTIONS
# =====================================================

def get_user_farms(user_id):
    """Get all farms for a user"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT farm_id, farm_name, total_area_hectares, elevation_masl,
                   location_province, location_municipality, location_barangay
            FROM farms
            WHERE user_id = %s AND is_active = TRUE
            ORDER BY farm_name
        """, (user_id,))
        
        farms = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(farm) for farm in farms]
    except Exception as e:
        st.error(f"Error fetching farms: {e}")
        conn.close()
        return []

def create_farm(user_id, farm_data):
    """Create a new farm"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO farms (
                user_id, farm_name, location_province, location_municipality,
                location_barangay, total_area_hectares, elevation_masl,
                established_date, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING farm_id
        """, (
            user_id,
            farm_data['farm_name'],
            farm_data.get('location_province'),
            farm_data.get('location_municipality'),
            farm_data.get('location_barangay'),
            farm_data['total_area_hectares'],
            farm_data.get('elevation_masl'),
            farm_data.get('established_date'),
            farm_data.get('notes')
        ))
        
        farm_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return farm_id
    except Exception as e:
        conn.rollback()
        conn.close()
        st.error(f"Error creating farm: {e}")
        return None

def get_farm_lots(farm_id):
    """Get all coffee lots for a farm"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT lot_id, lot_name, area_hectares, planting_date, variety, total_plants
            FROM coffee_lots
            WHERE farm_id = %s AND is_active = TRUE
            ORDER BY lot_name
        """, (farm_id,))
        
        lots = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(lot) for lot in lots]
    except Exception as e:
        st.error(f"Error fetching lots: {e}")
        conn.close()
        return []

# =====================================================
# HARVEST & GRADE ASSESSMENT FUNCTIONS
# =====================================================

def create_harvest(lot_id, harvest_data):
    """Create a new harvest record"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO harvests (
                lot_id, harvest_date, harvest_season, harvest_method,
                cherries_harvested_kg, green_beans_kg, processing_method,
                moisture_content_pct, notes, harvested_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING harvest_id
        """, (
            lot_id,
            harvest_data['harvest_date'],
            harvest_data.get('harvest_season'),
            harvest_data.get('harvest_method'),
            harvest_data.get('cherries_harvested_kg'),
            harvest_data.get('green_beans_kg'),
            harvest_data.get('processing_method'),
            harvest_data.get('moisture_content_pct'),
            harvest_data.get('notes'),
            st.session_state.get('user_id')
        ))
        
        harvest_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return harvest_id
    except Exception as e:
        conn.rollback()
        conn.close()
        st.error(f"Error creating harvest: {e}")
        return None

def save_grade_assessment(harvest_id, assessment_data):
    """Save grade assessment to database"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO grade_assessments (
                harvest_id, assessment_date, sample_weight_g,
                primary_defects, secondary_defects, total_defect_count,
                total_defect_pct, bean_screen_size_mm, bean_size_class,
                pns_grade, coffee_grade, cupping_score,
                climate_suitability_robusta, soil_suitability_robusta,
                moisture_suitability, overall_quality_index,
                environmental_stress_index, defect_details, assessed_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING assessment_id
        """, (
            harvest_id,
            assessment_data.get('assessment_date', date.today()),
            assessment_data.get('sample_weight_g', 350.0),
            assessment_data.get('primary_defects', 0),
            assessment_data.get('secondary_defects', 0),
            assessment_data.get('total_defect_count', 0),
            assessment_data.get('total_defect_pct', 0.0),
            assessment_data.get('bean_screen_size_mm'),
            assessment_data.get('bean_size_class'),
            assessment_data.get('pns_grade'),
            assessment_data.get('coffee_grade'),
            assessment_data.get('cupping_score'),
            assessment_data.get('climate_suitability_robusta'),
            assessment_data.get('soil_suitability_robusta'),
            assessment_data.get('moisture_suitability'),
            assessment_data.get('overall_quality_index'),
            assessment_data.get('environmental_stress_index'),
            json.dumps(assessment_data.get('defect_details', {})),
            st.session_state.get('user_id')
        ))
        
        assessment_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return assessment_id
    except Exception as e:
        conn.rollback()
        conn.close()
        st.error(f"Error saving assessment: {e}")
        return None

def get_user_harvests(user_id, limit=20):
    """Get recent harvests for a user"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT 
                h.harvest_id, h.harvest_date, h.green_beans_kg,
                f.farm_name, cl.lot_name,
                ga.coffee_grade, ga.pns_grade, ga.cupping_score,
                ga.total_defect_pct, ga.bean_size_class
            FROM harvests h
            JOIN coffee_lots cl ON h.lot_id = cl.lot_id
            JOIN farms f ON cl.farm_id = f.farm_id
            LEFT JOIN grade_assessments ga ON h.harvest_id = ga.harvest_id
            WHERE f.user_id = %s
            ORDER BY h.harvest_date DESC
            LIMIT %s
        """, (user_id, limit))
        
        harvests = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(h) for h in harvests]
    except Exception as e:
        st.error(f"Error fetching harvests: {e}")
        conn.close()
        return []

# =====================================================
# PREDICTION & FORECAST FUNCTIONS
# =====================================================

def save_prediction(user_id, prediction_data):
    """Save prediction to database"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO predictions (
                user_id, farm_id, lot_id, prediction_type,
                input_parameters, predicted_grade, predicted_pns_grade,
                predicted_defect_pct, predicted_cupping_score,
                confidence_score, model_name, model_version, notes
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING prediction_id
        """, (
            user_id,
            prediction_data.get('farm_id'),
            prediction_data.get('lot_id'),
            prediction_data.get('prediction_type', 'grade_prediction'),
            json.dumps(prediction_data.get('input_parameters', {})),
            prediction_data.get('predicted_grade'),
            prediction_data.get('predicted_pns_grade'),
            prediction_data.get('predicted_defect_pct'),
            prediction_data.get('predicted_cupping_score'),
            prediction_data.get('confidence_score', 0.0),
            prediction_data.get('model_name', 'RandomForest'),
            prediction_data.get('model_version', '1.0'),
            prediction_data.get('notes')
        ))
        
        prediction_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return prediction_id
    except Exception as e:
        conn.rollback()
        conn.close()
        st.error(f"Error saving prediction: {e}")
        return None

def save_yield_forecast(user_id, forecast_data):
    """Save yield forecast to database"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO yield_forecasts (
                user_id, farm_id, lot_id, forecast_period_years, base_year,
                plant_age_months, farm_area_ha, fertilization_type,
                fertilization_frequency, pest_management_frequency,
                climate_suitability, soil_suitability, overall_quality_index,
                forecast_data, total_yield_kg, avg_yield_per_year_kg_ha,
                avg_fine_probability, avg_premium_probability,
                avg_commercial_probability, notes
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING forecast_id
        """, (
            user_id,
            forecast_data.get('farm_id'),
            forecast_data.get('lot_id'),
            forecast_data.get('forecast_period_years'),
            forecast_data.get('base_year', datetime.now().year),
            forecast_data.get('plant_age_months'),
            forecast_data.get('farm_area_ha'),
            forecast_data.get('fertilization_type'),
            forecast_data.get('fertilization_frequency'),
            forecast_data.get('pest_management_frequency'),
            forecast_data.get('climate_suitability'),
            forecast_data.get('soil_suitability'),
            forecast_data.get('overall_quality_index'),
            json.dumps(forecast_data.get('forecast_data', [])),
            forecast_data.get('total_yield_kg'),
            forecast_data.get('avg_yield_per_year_kg_ha'),
            forecast_data.get('avg_fine_probability'),
            forecast_data.get('avg_premium_probability'),
            forecast_data.get('avg_commercial_probability'),
            forecast_data.get('notes')
        ))
        
        forecast_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return forecast_id
    except Exception as e:
        conn.rollback()
        conn.close()
        st.error(f"Error saving forecast: {e}")
        return None

# =====================================================
# ENVIRONMENTAL DATA FUNCTIONS
# =====================================================

def save_environmental_data(farm_id, env_data):
    """Save environmental data for a farm"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO environmental_data (
                farm_id, record_date, monthly_temp_avg_c, monthly_temp_min_c,
                monthly_temp_max_c, monthly_rainfall_mm, relative_humidity_pct,
                soil_pH, soil_moisture_pct, soil_organic_matter_pct,
                recorded_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (farm_id, record_date) 
            DO UPDATE SET
                monthly_temp_avg_c = EXCLUDED.monthly_temp_avg_c,
                monthly_rainfall_mm = EXCLUDED.monthly_rainfall_mm,
                soil_pH = EXCLUDED.soil_pH,
                soil_moisture_pct = EXCLUDED.soil_moisture_pct
            RETURNING env_id
        """, (
            farm_id,
            env_data['record_date'],
            env_data.get('monthly_temp_avg_c'),
            env_data.get('monthly_temp_min_c'),
            env_data.get('monthly_temp_max_c'),
            env_data.get('monthly_rainfall_mm'),
            env_data.get('relative_humidity_pct'),
            env_data.get('soil_pH'),
            env_data.get('soil_moisture_pct'),
            env_data.get('soil_organic_matter_pct'),
            st.session_state.get('user_id')
        ))
        
        env_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return env_id
    except Exception as e:
        conn.rollback()
        conn.close()
        st.error(f"Error saving environmental data: {e}")
        return None

def get_farm_environmental_data(farm_id, months=12):
    """Get recent environmental data for a farm"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT 
                record_date, monthly_temp_avg_c, monthly_rainfall_mm,
                soil_pH, soil_moisture_pct, relative_humidity_pct
            FROM environmental_data
            WHERE farm_id = %s
            ORDER BY record_date DESC
            LIMIT %s
        """, (farm_id, months))
        
        data = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(d) for d in data]
    except Exception as e:
        st.error(f"Error fetching environmental data: {e}")
        conn.close()
        return []

# =====================================================
# ANALYTICS & DASHBOARD FUNCTIONS
# =====================================================

def get_dashboard_summary(user_id):
    """Get dashboard summary for a user"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT 
                COUNT(DISTINCT f.farm_id) as total_farms,
                COUNT(DISTINCT cl.lot_id) as total_lots,
                COUNT(DISTINCT h.harvest_id) as total_harvests,
                COALESCE(SUM(h.green_beans_kg), 0) as total_production_kg,
                COUNT(DISTINCT ga.assessment_id) as total_assessments,
                COUNT(DISTINCT CASE WHEN ga.coffee_grade = 'Fine' THEN ga.assessment_id END) as fine_count,
                COUNT(DISTINCT CASE WHEN ga.coffee_grade = 'Premium' THEN ga.assessment_id END) as premium_count,
                AVG(ga.cupping_score) as avg_cupping_score,
                AVG(ga.total_defect_pct) as avg_defect_pct
            FROM users u
            LEFT JOIN farms f ON u.user_id = f.user_id AND f.is_active = TRUE
            LEFT JOIN coffee_lots cl ON f.farm_id = cl.farm_id AND cl.is_active = TRUE
            LEFT JOIN harvests h ON cl.lot_id = h.lot_id
            LEFT JOIN grade_assessments ga ON h.harvest_id = ga.harvest_id
            WHERE u.user_id = %s
        """, (user_id,))
        
        summary = cur.fetchone()
        cur.close()
        conn.close()
        return dict(summary) if summary else None
    except Exception as e:
        st.error(f"Error fetching dashboard summary: {e}")
        conn.close()
        return None

def get_grade_distribution(user_id):
    """Get grade distribution for a user"""
    conn = get_db_connection()
    if not conn:
        return pd.DataFrame()
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT 
                ga.coffee_grade,
                COUNT(*) as count,
                AVG(ga.cupping_score) as avg_cupping,
                AVG(ga.total_defect_pct) as avg_defects
            FROM grade_assessments ga
            JOIN harvests h ON ga.harvest_id = h.harvest_id
            JOIN coffee_lots cl ON h.lot_id = cl.lot_id
            JOIN farms f ON cl.farm_id = f.farm_id
            WHERE f.user_id = %s
            GROUP BY ga.coffee_grade
            ORDER BY 
                CASE ga.coffee_grade
                    WHEN 'Fine' THEN 1
                    WHEN 'Premium' THEN 2
                    WHEN 'Commercial' THEN 3
                END
        """, (user_id,))
        
        data = cur.fetchall()
        cur.close()
        conn.close()
        return pd.DataFrame([dict(d) for d in data])
    except Exception as e:
        st.error(f"Error fetching grade distribution: {e}")
        conn.close()
        return pd.DataFrame()

# =====================================================
# STREAMLIT INTEGRATION EXAMPLE
# =====================================================

def login_page():
    """Login page for Streamlit"""
    st.title("☕ Robusta Coffee Dashboard")
    st.markdown("### Login to Your Account")
    
    tab1, tab2 = st.tabs(["Login", "Register"])
    
    with tab1:
        username = st.text_input("Username", key="login_username")
        password = st.text_input("Password", type="password", key="login_password")
        
        if st.button("Login", type="primary"):
            if username and password:
                user = authenticate_user(username, password)
                if user:
                    st.session_state.user_id = user['user_id']
                    st.session_state.username = user['username']
                    st.session_state.full_name = user['full_name']
                    st.success(f"Welcome, {user['full_name']}!")
                    st.rerun()
                else:
                    st.error("Invalid username or password")
            else:
                st.warning("Please enter both username and password")
    
    with tab2:
        st.markdown("### Create New Account")
        reg_username = st.text_input("Username", key="reg_username")
        reg_email = st.text_input("Email", key="reg_email")
        reg_password = st.text_input("Password", type="password", key="reg_password")
        reg_full_name = st.text_input("Full Name", key="reg_full_name")
        reg_phone = st.text_input("Phone Number (optional)", key="reg_phone")
        
        if st.button("Register", type="primary"):
            if reg_username and reg_email and reg_password and reg_full_name:
                try:
                    user = register_user(reg_username, reg_email, reg_password, reg_full_name, reg_phone)
                    if user:
                        st.success(f"Account created successfully! Please login.")
                        st.info(f"Username: {user['username']}")
                except ValueError as e:
                    st.error(str(e))
            else:
                st.warning("Please fill in all required fields")

def main_dashboard():
    """Main dashboard after login"""
    if 'user_id' not in st.session_state:
        login_page()
        return
    
    st.title(f"Welcome, {st.session_state.full_name}!")
    
    # Get dashboard summary
    summary = get_dashboard_summary(st.session_state.user_id)
    
    if summary:
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Farms", summary['total_farms'])
        with col2:
            st.metric("Total Harvests", summary['total_harvests'])
        with col3:
            st.metric("Total Production", f"{summary['total_production_kg']:.1f} kg")
        with col4:
            st.metric("Avg Cupping Score", f"{summary['avg_cupping_score']:.1f}" if summary['avg_cupping_score'] else "N/A")
    
    # Logout button
    if st.sidebar.button("Logout"):
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.rerun()

# Example usage in your main app:
# if __name__ == "__main__":
#     if 'user_id' not in st.session_state:
#         login_page()
#     else:
#         main_dashboard()

