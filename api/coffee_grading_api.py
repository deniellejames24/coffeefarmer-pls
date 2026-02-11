"""
Coffee Grading API Server
Replaces RStudio API endpoint with Python implementation
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from grading_logic import predict_coffee_grade

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Coffee Grading API',
        'version': '1.0.0'
    }), 200

@app.route('/predict', methods=['GET'])
def predict():
    """
    Predict coffee grade based on sample parameters
    Compatible with existing R API endpoint
    
    Query Parameters:
    - altitude: Elevation in meters (optional, default: 0)
    - bag_weight: Bag weight in kg (optional, kept for compatibility)
    - processing_method: 0=Washed/Wet, 1=Natural/Dry (required)
    - colors: 0=Green, 1=Bluish-Green, 2=Blue-Green (required)
    - moisture: Moisture percentage 0-20 (required)
    - category_one_defects: Primary defects count (required)
    - category_two_defects: Secondary defects count (required)
    
    Returns:
    {
        "predicted_quality_grade": "Fine" | "Premium" | "Commercial",
        "cupping_score": float,
        "pns_grade": int,
        "total_defect_pct": float,
        "primary_defects": int,
        "secondary_defects": int,
        "total_defects": int
    }
    """
    try:
        # Get parameters from query string
        altitude = request.args.get('altitude', 0)
        bag_weight = request.args.get('bag_weight', 0)
        processing_method = request.args.get('processing_method')
        colors = request.args.get('colors')
        moisture = request.args.get('moisture')
        category_one_defects = request.args.get('category_one_defects', 0)
        category_two_defects = request.args.get('category_two_defects', 0)
        
        # Validate required parameters
        if processing_method is None:
            return jsonify({'error': 'processing_method is required'}), 400
        if colors is None:
            return jsonify({'error': 'colors is required'}), 400
        if moisture is None:
            return jsonify({'error': 'moisture is required'}), 400
        
        logger.info(f"Prediction request: altitude={altitude}, processing={processing_method}, "
                   f"colors={colors}, moisture={moisture}, "
                   f"defects1={category_one_defects}, defects2={category_two_defects}")
        
        # Call prediction function
        result = predict_coffee_grade(
            altitude=altitude,
            bag_weight=bag_weight,
            processing_method=processing_method,
            colors=colors,
            moisture=moisture,
            category_one_defects=category_one_defects,
            category_two_defects=category_two_defects
        )
        
        logger.info(f"Prediction result: {result['predicted_quality_grade']}")
        
        return jsonify(result), 200
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 7249))
    host = os.environ.get('HOST', '127.0.0.1')
    
    logger.info(f"Starting Coffee Grading API server on {host}:{port}")
    app.run(host=host, port=port, debug=False)




