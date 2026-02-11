#!/bin/bash
# Start Coffee Grading API Server

echo "Starting Coffee Grading API Server..."
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if dependencies are installed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Start the server
echo "Starting server on http://127.0.0.1:7249"
echo "Press Ctrl+C to stop"
echo ""

cd "$(dirname "$0")"
python3 coffee_grading_api.py




