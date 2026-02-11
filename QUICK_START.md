# Quick Start Guide - Python Coffee Grading API

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the API Server

**Windows:**
```bash
cd api
start_api.bat
```

**Linux/Mac:**
```bash
cd api
chmod +x start_api.sh
./start_api.sh
```

**Or manually:**
```bash
cd api
python coffee_grading_api.py
```

### 3. Verify It's Working
Open a new terminal and run:
```bash
curl http://127.0.0.1:7249/health
```

You should see:
```json
{"status":"healthy","service":"Coffee Grading API","version":"1.0.0"}
```

### 4. Test a Prediction
```bash
curl "http://127.0.0.1:7249/predict?altitude=900&processing_method=0&colors=2&moisture=12&category_one_defects=0&category_two_defects=3"
```

### 5. Stop R API (if running)
Stop the RStudio/R API server that was using port 7249.

### 6. Use Your Frontend
Your frontend application should now work with the Python API automatically!

## ✅ That's It!

The Python API is now running and ready to replace the R API. Your frontend will automatically use it since it uses the same endpoint (`http://127.0.0.1:7249/predict`).

## 📋 What Changed?

- **Same endpoint**: `http://127.0.0.1:7249/predict`
- **Same parameters**: All input parameters are identical
- **Better output**: Returns more information (cupping score, PNS grade, etc.)
- **Better grades**: Returns "Fine", "Premium", "Commercial" (frontend already handles both formats)

## 🆘 Troubleshooting

**Port already in use?**
- Stop the R API server first
- Or change port: `PORT=8000 python coffee_grading_api.py`

**Import errors?**
- Make sure you installed dependencies: `pip install -r requirements.txt`
- Make sure you're in the project root directory

**API not responding?**
- Check if server is running: `curl http://127.0.0.1:7249/health`
- Check server logs for errors

## 📚 More Information

- **Full API Documentation**: See `README_API.md`
- **Migration Details**: See `MIGRATION_SUMMARY.md`
- **Migration Plan**: See `MIGRATION_PLAN.md`




