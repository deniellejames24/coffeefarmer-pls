# ML Integration Database Migrations

This directory contains SQL migration scripts for integrating the ML backend into the CoffeeFarmer system.

## Migration Files

### Execution Order

Execute these migrations in the following order:

1. **001_create_yield_forecasts.sql** - Creates table for yield forecasts
2. **002_create_quality_predictions.sql** - Creates table for quality predictions
3. **003_create_ml_recommendations.sql** - Creates table for ML recommendations
4. **004_create_ml_models.sql** - Creates table for ML model versioning (optional)
5. **005_alter_existing_tables.sql** - Adds ML columns to existing tables
6. **006_create_views.sql** - Creates analytics views
7. **007_rls_policies.sql** - Additional RLS policies and security functions

## Prerequisites

- PostgreSQL 12+ or Supabase
- Existing tables: `users`, `farmer_detail`, `plant_data`, `plant_status`, `harvest_data`, `coffee_samples`
- Authentication system with `auth.uid()` function (Supabase Auth)

## Execution

### Option 1: Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Execute each file in order (001 → 007)
3. Verify each migration completes successfully

### Option 2: Command Line (psql)

```bash
# Connect to database
psql -h your-db-host -U postgres -d your-database

# Execute migrations
\i migrations/ml_integration/001_create_yield_forecasts.sql
\i migrations/ml_integration/002_create_quality_predictions.sql
\i migrations/ml_integration/003_create_ml_recommendations.sql
\i migrations/ml_integration/004_create_ml_models.sql
\i migrations/ml_integration/005_alter_existing_tables.sql
\i migrations/ml_integration/006_create_views.sql
\i migrations/ml_integration/007_rls_policies.sql
```

### Option 3: Migration Tool

If using a migration tool (e.g., Flyway, Alembic), ensure scripts are executed in order.

## Verification

After running migrations, verify:

1. **Tables created:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
       'yield_forecasts', 
       'quality_predictions', 
       'ml_recommendations', 
       'ml_models'
   );
   ```

2. **Columns added:**
   ```sql
   -- Check plant_data
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'plant_data' 
   AND column_name IN ('bean_screen_size_mm', 'last_quality_prediction_date', 'last_yield_forecast_date');
   
   -- Check coffee_samples
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'coffee_samples' 
   AND column_name IN ('bean_screen_size_mm', 'climate_suitability', 'soil_suitability', 
                       'overall_quality_index', 'elevation_score', 'bean_size_class');
   
   -- Check harvest_data
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'harvest_data' 
   AND column_name IN ('forecasted_yield_kg', 'forecasted_fine_kg', 'forecasted_premium_kg', 
                       'forecasted_commercial_kg', 'forecast_accuracy_score');
   ```

3. **Views created:**
   ```sql
   SELECT table_name FROM information_schema.views 
   WHERE table_schema = 'public' 
   AND table_name IN ('farmer_ml_insights', 'plant_ml_summary');
   ```

4. **RLS enabled:**
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename IN ('yield_forecasts', 'quality_predictions', 'ml_recommendations', 'ml_models');
   ```

5. **Policies created:**
   ```sql
   SELECT tablename, policyname FROM pg_policies 
   WHERE schemaname = 'public' 
   AND tablename IN ('yield_forecasts', 'quality_predictions', 'ml_recommendations', 'ml_models');
   ```

## Rollback

If you need to rollback these migrations:

```sql
-- Drop views
DROP VIEW IF EXISTS plant_ml_summary;
DROP VIEW IF EXISTS farmer_ml_insights;

-- Drop helper functions
DROP FUNCTION IF EXISTS is_farmer_owner(UUID);
DROP FUNCTION IF EXISTS is_admin();

-- Drop tables (cascade will handle foreign keys)
DROP TABLE IF EXISTS ml_models CASCADE;
DROP TABLE IF EXISTS ml_recommendations CASCADE;
DROP TABLE IF EXISTS quality_predictions CASCADE;
DROP TABLE IF EXISTS yield_forecasts CASCADE;

-- Remove columns from existing tables
ALTER TABLE harvest_data 
DROP COLUMN IF EXISTS forecast_accuracy_score,
DROP COLUMN IF EXISTS forecasted_commercial_kg,
DROP COLUMN IF EXISTS forecasted_premium_kg,
DROP COLUMN IF EXISTS forecasted_fine_kg,
DROP COLUMN IF EXISTS forecasted_yield_kg;

ALTER TABLE coffee_samples 
DROP COLUMN IF EXISTS bean_size_class,
DROP COLUMN IF EXISTS elevation_score,
DROP COLUMN IF EXISTS overall_quality_index,
DROP COLUMN IF EXISTS soil_suitability,
DROP COLUMN IF EXISTS climate_suitability,
DROP COLUMN IF EXISTS bean_screen_size_mm;

ALTER TABLE plant_data 
DROP COLUMN IF EXISTS last_yield_forecast_date,
DROP COLUMN IF EXISTS last_quality_prediction_date,
DROP COLUMN IF EXISTS bean_screen_size_mm;
```

## Notes

- All migrations are **idempotent** - safe to run multiple times
- All new columns are **nullable** - won't break existing data
- RLS policies enforce data isolation between farmers
- Admins have full access to all ML tables
- Service role (if used) should have BYPASS RLS privilege

## Support

For issues or questions:
1. Check migration logs for errors
2. Verify prerequisites are met
3. Review RLS policies if access issues occur
4. Consult `PY_API_INTEGRATION_ANALYSIS.md` for detailed specifications

