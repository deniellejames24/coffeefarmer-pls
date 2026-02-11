# CoffeeFarmer System - Elevation and Cluster Size Update

## Overview

This update enhances the CoffeeFarmer system to support individual elevation and cluster size tracking for each coffee plant, rather than using a generalized farm elevation. This provides more accurate and detailed information for coffee quality analysis and farm management.

## Key Changes

### 1. Database Schema Updates

#### New Columns Added to `plant_data` Table:
- **`elevation`** (float8): Individual elevation of each plant cluster in meters above sea level
- **`cluster_size`** (float8): Size of each plant cluster in square meters

#### Farm Elevation Behavior Change:
- **Before**: Single elevation value stored in `farmer_detail.farm_elevation` (numeric type)
- **After**: Farm elevation is calculated as a range (lowest-highest) from all plant cluster elevations and stored as text (e.g., "1100-1500 meters")

### 2. User Interface Updates

#### Land & Plant Declaration Page:
- **Form Fields**: Added elevation and cluster size inputs for each plant cluster
- **Terminology**: Changed from "Coffee Plants" to "Coffee Plant Clusters"
- **Farm Details**: Farm elevation now shows as a calculated range (e.g., "1100-1500 meters")
- **Table Display**: Added columns for elevation and cluster size
- **PDF Export**: Updated to include new fields in the exported document

#### Example Plant Cluster Entry:
```
Plant Cluster 1:
- Variety: Robusta
- Elevation: 1100 meters
- Number of Trees: 100
- Cluster Size: 15000 square meters

Plant Cluster 2:
- Variety: Robusta
- Elevation: 1500 meters
- Number of Trees: 150
- Cluster Size: 20000 square meters
```

#### Example Farm Details Display:
```
Farm Location: Igbaras
Farm Size: 5 hectares
Farm Elevation: 1100-1500 meters (calculated range)
```

### 3. Technical Implementation

#### New Functions:
- `calculateFarmElevationRange(plants)`: Calculates the elevation range from all plant clusters
- Enhanced form validation for elevation and cluster size fields
- Automatic farm elevation updates when plant clusters are added/edited/deleted

#### Database Operations:
- Enhanced CRUD operations for plant_data with new fields
- Automatic farm elevation recalculation on plant data changes
- Activity logging for all elevation and cluster size changes

## Migration Instructions

### 1. Database Migration
Run the provided SQL migration script:
```sql
-- Execute plant_data_elevation_migration.sql
```

**Important**: This migration includes changing the `farm_elevation` column type from numeric to text to support elevation ranges. If you encounter any issues, you can run the separate migration:
```sql
-- Execute farm_elevation_text_migration.sql
```

### 2. Code Deployment
- Deploy the updated `LandDeclaration.jsx` component
- Ensure all new fields are properly handled in the database operations

### 3. Data Migration (Optional)
For existing data, you may want to:
- Set default elevation values for existing plant records
- Calculate initial farm elevation ranges from existing data

## Benefits

### 1. Improved Accuracy
- Individual plant cluster elevations provide more precise data
- Better correlation between elevation and coffee quality
- More accurate farm management decisions

### 2. Enhanced Analytics
- Elevation-based quality analysis per cluster
- Cluster size optimization insights
- Better harvest planning based on elevation zones

### 3. Better User Experience
- Clear distinction between plant clusters
- Visual representation of elevation ranges
- More detailed farm documentation

## Backward Compatibility

- Existing plant records will continue to work (new fields will be NULL initially)
- Farm elevation will be calculated as a range when plant clusters have elevation data
- All existing functionality remains intact

## Future Enhancements

### Potential Additions:
1. **Elevation Zone Analysis**: Group plants by elevation ranges for quality analysis
2. **Cluster Size Optimization**: Recommendations based on cluster size and yield
3. **Elevation-based Pricing**: Quality-based pricing recommendations
4. **Weather Integration**: Elevation-specific weather data and recommendations

### Analytics Features:
1. **Quality Correlation**: Analyze coffee quality vs. elevation
2. **Yield Optimization**: Cluster size vs. yield analysis
3. **Climate Adaptation**: Elevation-based climate recommendations

## Testing Checklist

- [ ] Add new plant cluster with elevation and cluster size
- [ ] Edit existing plant cluster elevation and cluster size
- [ ] Delete plant cluster and verify farm elevation recalculation
- [ ] Verify PDF export includes new fields
- [ ] Test form validation for new fields
- [ ] Verify farm elevation range calculation
- [ ] Test activity logging for new fields
- [ ] Verify backward compatibility with existing data

## Troubleshooting

### Common Issues:

1. **"invalid input syntax for type double precision" Error**
   - **Cause**: The `farm_elevation` column is still numeric type
   - **Solution**: Run the database migration to change the column type to text
   ```sql
   ALTER TABLE farmer_detail ALTER COLUMN farm_elevation TYPE text;
   ```

2. **Farm Elevation Shows as "Not specified"**
   - **Cause**: No plant clusters have been added yet
   - **Solution**: Add plant clusters with elevation data first

3. **Elevation Range Not Updating**
   - **Cause**: Plant cluster changes not triggering farm elevation recalculation
   - **Solution**: Ensure the `calculateFarmElevationRange` function is called after plant data changes

## Support

For questions or issues related to this update, please refer to:
- Database schema documentation
- API documentation for plant_data operations
- User manual for Land & Plant Declaration page 