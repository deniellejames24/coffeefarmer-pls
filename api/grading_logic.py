"""
Coffee Grading Logic - Extracted from robusta_coffee_dashboard.py
Based on CQI/UCDA Fine Robusta Classification System
"""

def calculate_pns_grade(total_defect_pct):
    """
    Calculate PNS grade based on total defect percentage for Robusta
    Grade 1: max 10%
    Grade 2: max 15%
    Grade 3: max 25%
    Grade 4: max 40%
    """
    if total_defect_pct <= 10:
        return 1
    elif total_defect_pct <= 15:
        return 2
    elif total_defect_pct <= 25:
        return 3
    elif total_defect_pct <= 40:
        return 4
    else:
        return 5  # Below standard


def calculate_fine_premium_grade(primary_defects, secondary_defects, cupping_score=82):
    """
    Calculate Fine/Premium Robusta grade based on CQI/UCDA standards
    Fine Robusta: 0 primary defects, max 5 secondary defects, score >= 80
    Premium Robusta: max 12 combined defects, score >= 80
    Commercial: otherwise
    """
    if primary_defects == 0 and secondary_defects <= 5 and cupping_score >= 80:
        return 'Fine'
    elif (primary_defects + secondary_defects) <= 12 and cupping_score >= 80:
        return 'Premium'
    else:
        return 'Commercial'


def calculate_cupping_score(altitude, processing_method, colors, moisture, 
                           primary_defects, secondary_defects):
    """
    Calculate estimated cupping score based on input parameters
    Base score: 75, adjusted by quality factors (max 95)
    """
    # Base score
    base_score = 75.0
    
    # Elevation factor (optimal: 600-1200 masl, center: 900)
    if altitude:
        elevation_optimal_center = 900
        elevation_optimal_range = 300
        elevation_score = 1 - abs(altitude - elevation_optimal_center) / elevation_optimal_range
        elevation_score = max(0, min(1, elevation_score))
    else:
        elevation_score = 0.8  # Default if not provided
    
    # Processing method factor (0=Washed/Wet is better, 1=Natural/Dry)
    processing_score = 0.95 if processing_method == 0 else 0.85
    
    # Color factor (0=Green, 1=Bluish-Green, 2=Blue-Green)
    # Blue-Green (2) is best, Green (0) is worst
    color_scores = {0: 0.80, 1: 0.90, 2: 0.95}
    color_score = color_scores.get(colors, 0.85)
    
    # Moisture factor (optimal: 12-14%, penalize if too high or too low)
    if 12 <= moisture <= 14:
        moisture_score = 1.0
    elif 10 <= moisture < 12 or 14 < moisture <= 15:
        moisture_score = 0.95
    elif 8 <= moisture < 10 or 15 < moisture <= 16:
        moisture_score = 0.90
    else:
        moisture_score = 0.80
    
    # Defect penalty (more defects = lower score)
    total_defects = primary_defects + secondary_defects
    if total_defects == 0:
        defect_penalty = 0
    elif total_defects <= 5:
        defect_penalty = -2
    elif total_defects <= 12:
        defect_penalty = -5
    else:
        defect_penalty = -10
    
    # Primary defects are more severe
    if primary_defects > 0:
        defect_penalty -= (primary_defects * 3)
    
    # Calculate overall quality index
    quality_index = (
        elevation_score * 0.25 +
        processing_score * 0.20 +
        color_score * 0.20 +
        moisture_score * 0.15 +
        0.20  # Base quality
    )
    
    # Calculate cupping score
    cupping_score = base_score + (quality_index * 20) + defect_penalty
    
    # Clamp between 60 and 95
    cupping_score = max(60, min(95, cupping_score))
    
    return round(cupping_score, 1)


def predict_coffee_grade(altitude, bag_weight, processing_method, colors, 
                         moisture, category_one_defects, category_two_defects):
    """
    Main prediction function that matches the R API interface
    
    Parameters:
    - altitude: Elevation in meters above sea level
    - bag_weight: Bag weight in kg (not used in calculation but kept for compatibility)
    - processing_method: 0=Washed/Wet, 1=Natural/Dry
    - colors: 0=Green, 1=Bluish-Green, 2=Blue-Green
    - moisture: Moisture percentage (0-20)
    - category_one_defects: Primary defects count
    - category_two_defects: Secondary defects count
    
    Returns:
    - dict with predicted_quality_grade and additional metadata
    """
    # Convert inputs to appropriate types
    try:
        altitude = float(altitude) if altitude else 0
        processing_method = int(processing_method) if processing_method is not None else 0
        colors = int(colors) if colors is not None else 0
        moisture = float(moisture) if moisture else 0
        primary_defects = int(category_one_defects) if category_one_defects is not None else 0
        secondary_defects = int(category_two_defects) if category_two_defects is not None else 0
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid input parameter: {e}")
    
    # Calculate cupping score
    cupping_score = calculate_cupping_score(
        altitude, processing_method, colors, moisture,
        primary_defects, secondary_defects
    )
    
    # Calculate grade
    predicted_grade = calculate_fine_premium_grade(
        primary_defects, secondary_defects, cupping_score
    )
    
    # Calculate total defect percentage for PNS reference
    # Assume 350g sample, average bean weight ~0.15g per bean
    total_beans_sample = 350 / 0.15  # approximately 2333 beans
    total_defect_count = primary_defects + secondary_defects
    total_defect_pct = (total_defect_count / total_beans_sample) * 100
    
    # Get PNS grade
    pns_grade = calculate_pns_grade(total_defect_pct)
    
    return {
        'predicted_quality_grade': predicted_grade,
        'cupping_score': cupping_score,
        'pns_grade': pns_grade,
        'total_defect_pct': round(total_defect_pct, 2),
        'primary_defects': primary_defects,
        'secondary_defects': secondary_defects,
        'total_defects': total_defect_count
    }




