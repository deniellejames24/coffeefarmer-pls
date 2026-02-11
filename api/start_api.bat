@echo off
REM Start Coffee Grading API Server (Windows)

echo Starting Coffee Grading API Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if dependencies are installed
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements.txt
)

REM Start the server
echo Starting server on http://127.0.0.1:7249
echo Press Ctrl+C to stop
echo.

cd /d "%~dp0"
python coffee_grading_api.py




