# CoffeeFarmer System Structure

## Root Directory

```
CoffeeFarmer/
├── .git/                          # Git repository
├── .gitattributes                 # Git attributes configuration
├── node_modules/                  # Node.js dependencies (excluded from detail)
├── dist/                          # Build output directory
│   ├── assets/
│   │   ├── coffeebean-2ccda422.png
│   │   ├── html2canvas.esm-e0a7d97b.js
│   │   ├── index-aee4154f.css
│   │   ├── index-ea60799b.js
│   │   ├── index.es-1665f5e4.js
│   │   ├── purify.es-31816194.js
│   │   └── models/
│   │       ├── a-coffee-tree/
│   │       │   └── source/
│   │       │       └── coffee-step00002/
│   │       │           ├── coffee-step00002.mtl
│   │       │           └── coffee-step00002.obj
│   │       └── coffee-bean/
│   │           └── source/
│   │               └── Coffee Bean.fbx
│   └── index.html
├── public/                        # Public assets
│   └── assets/
│       └── models/
│           ├── a-coffee-tree/
│           │   └── source/
│           │       └── coffee-step00002/
│           │           ├── coffee-step00002.mtl
│           │           └── coffee-step00002.obj
│           └── coffee-bean/
│               └── source/
│                   └── Coffee Bean.fbx
├── src/                           # Source code
│   ├── App.css
│   ├── App.jsx                    # Main application component
│   ├── main.jsx                   # Application entry point
│   ├── assets/                    # Static assets
│   │   ├── AdminDashboard.jsx
│   │   ├── UserDashboard.jsx
│   │   ├── background.png
│   │   ├── coffeebean.png
│   │   ├── logo.png
│   │   ├── react.svg
│   │   └── models/
│   │       ├── a-coffee-tree/
│   │       │   └── source/
│   │       │       └── coffee-step00002/
│   │       │           ├── coffee-step00002.mtl
│   │       │           └── coffee-step00002.obj
│   │       ├── coffee-bean/
│   │       │   ├── source/
│   │       │   │   └── Coffee Bean.fbx
│   │       │   └── textures/
│   │       │       └── Coffee_Bean_Texture.jpeg
│   ├── components/                # React components
│   │   ├── analytics/
│   │   │   ├── AdminDSS.jsx
│   │   │   ├── MLInsights.jsx
│   │   │   └── PredictResult.jsx
│   │   ├── CoffeeScene.jsx
│   │   ├── Layout.jsx
│   │   ├── LoadingScreen.jsx
│   │   ├── Navbar.jsx
│   │   ├── PasswordInput.jsx
│   │   ├── SearchableDropdown.jsx
│   │   └── VerificationStatus.jsx
│   ├── config/                    # Configuration files
│   │   └── api.js
│   ├── context/                   # React context (empty)
│   ├── lib/                       # Library and utility files
│   │   ├── AuthProvider.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── supabaseClient.js
│   │   ├── ThemeContext.jsx
│   │   ├── weatherService.js
│   │   ├── ml/                    # Machine learning modules
│   │   │   ├── AdvancedAnalytics.js
│   │   │   ├── DecisionSupportSystem.js
│   │   │   ├── QualityPredictor.ts
│   │   │   └── TimeSeriesAnalysis.js
│   │   └── utils/                 # Utility functions
│   │       └── dateUtils.ts
│   ├── pages/                     # Page components
│   │   ├── AdminAnalytics.jsx
│   │   ├── AdminVerification.jsx
│   │   ├── CoffeeSampleGrading.jsx
│   │   ├── Dashboard.jsx
│   │   ├── DataEntry.jsx
│   │   ├── DSSRecommendations.jsx
│   │   ├── FarmerDashboard.jsx
│   │   ├── FarmerProfile.jsx
│   │   ├── FarmerRecommendations.jsx
│   │   ├── FarmerReports.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── HarvestReporting.jsx
│   │   ├── LandDeclaration.jsx
│   │   ├── LandingPage.jsx
│   │   ├── Login.jsx
│   │   ├── PlantStatus.jsx
│   │   ├── PredictiveAnalytics.jsx
│   │   ├── Register.jsx
│   │   ├── ResetPassword.jsx
│   │   ├── SinglePlantAnalytics.jsx
│   │   ├── UserManagement.jsx
│   │   └── UserProfile.jsx
│   └── styles/                    # Stylesheets
│       ├── index.css
│       ├── landing.css
│       ├── loading.css
│       ├── Login.css
│       ├── Register.css
│       └── Styles.css
├── api/                           # Backend API
│   ├── coffee_grading_api.py
│   ├── grading_logic.py
│   ├── start_api.bat
│   └── start_api.sh
├── py try/                        # Python experiments/prototypes
│   ├── CODE_ANALYSIS_REPORT.md
│   ├── database_integration_example.py
│   ├── DATABASE_SCHEMA_DOCUMENTATION.md
│   ├── database_schema.sql
│   ├── DATABASE_SETUP_SUMMARY.md
│   ├── robusta_coffee_dashboard.py
│   └── robusta_coffee_dataset.csv
├── CoffeeFarmer/                  # Nested directory (may be empty or contain additional files)
├── admin_verification_schema.sql
├── admin_verification_schema_fixed.sql
├── coffee_sample_grading.sql
├── dump                           # Database dump file
├── eslint.config.js               # ESLint configuration
├── farm_elevation_text_migration.sql
├── index.html                     # HTML entry point
├── package.json                   # Node.js dependencies
├── package-lock.json              # Locked dependencies
├── plant_data_elevation_migration.sql
├── postcss.config.cjs             # PostCSS configuration
├── requirements.txt               # Python dependencies
├── tailwind.config.cjs            # Tailwind CSS configuration
├── vite.config.js                 # Vite build configuration
└── Documentation Files:
    ├── ADMIN_VERIFICATION_IMPLEMENTATION.md
    ├── ELEVATION_UPDATE_README.md
    ├── MIGRATION_PLAN.md
    ├── MIGRATION_SUMMARY.md
    ├── PITCH_DECK_OUTLINE.md
    ├── Q&A_PREPARATION.md
    ├── QUICK_START.md
    ├── README.md
    ├── README_API.md
    ├── STARTUP_COMPETITION_PRESENTATION.md
    └── SYSTEM_CONTEXT_SUMMARY.md
```

## Directory Summary

### Frontend (React/Vite)
- **src/**: Main source code directory
  - **pages/**: 23 page components
  - **components/**: Reusable UI components
  - **lib/**: Core libraries and utilities (auth, ML, weather)
  - **styles/**: CSS stylesheets
  - **assets/**: Images, models, and static files

### Backend API
- **api/**: Python-based API for coffee grading
  - `coffee_grading_api.py`: Main API file
  - `grading_logic.py`: Grading algorithms
  - Startup scripts for Windows and Linux

### Database
- SQL migration files for schema and data migrations
- Database dump file

### Configuration
- `package.json`: Node.js project configuration
- `vite.config.js`: Vite build tool configuration
- `tailwind.config.cjs`: Tailwind CSS configuration
- `eslint.config.js`: Code linting rules
- `postcss.config.cjs`: PostCSS processing

### Documentation
- Multiple markdown files covering implementation, migration, and project documentation

### Build Output
- **dist/**: Production build files
- **node_modules/**: Dependencies (not detailed)

### Experimental/Prototype
- **py try/**: Python experimentation directory with database integration examples



