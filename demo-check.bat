@echo off
echo ============================================
echo   Bahuraksha Demo Health Check
echo ============================================
echo.

set FAIL=0

:: 1. Check API
echo [1/6] API backend...
python -c "import urllib.request, json; r = json.loads(urllib.request.urlopen('http://localhost:8000/health', timeout=5).read()); print('  Status:', r.get('status', 'unknown')); print('  Models:', r.get('models_loaded', '?'))" >nul 2>&1
if %errorlevel% equ 0 (
    echo   PASS - API is running on port 8000
) else (
    echo   FAIL - API not reachable (start with start-demo.bat)
    set /a FAIL+=1
)

:: 2. Check Frontend
echo [2/6] Frontend...
curl -s -o nul -w "%%{http_code}" http://localhost:8080/ >nul 2>&1
if %errorlevel% equ 0 (
    echo   PASS - Frontend is running on port 8080
) else (
    echo   FAIL - Frontend not reachable
    set /a FAIL+=1
)

:: 3. Check Model Files
echo [3/6] Model files...
set MODELS_DIR=bahuraksha-api\models
if exist "%MODELS_DIR%\flood_model.pkl" (
    if exist "%MODELS_DIR%\landslide_model.pkl" (
        echo   PASS - Both model files exist
    ) else (
        echo   FAIL - landslide_model.pkl missing
        set /a FAIL+=1
    )
) else (
    echo   FAIL - flood_model.pkl missing
    set /a FAIL+=1
)

:: 4. Check CSV Data Files
echo [4/6] CSV data files...
set DATA_DIR=bahuraksha-api\data\raw
set MISSING_DATA=0

if exist "%DATA_DIR%\rainfall\gpm_bagmati_daily.csv" ( echo   PASS - Rainfall CSV ) else ( echo   MISS - Rainfall CSV missing; set /a MISSING_DATA+=1 )
if exist "%DATA_DIR%\discharge\glofas_bagmati_daily.csv" ( echo   PASS - Discharge CSV ) else ( echo   MISS - Discharge CSV missing; set /a MISSING_DATA+=1 )
if exist "%DATA_DIR%\sentinel\sentinel1_bagmati_daily.csv" ( echo   PASS - SAR CSV ) else ( echo   MISS - SAR CSV missing; set /a MISSING_DATA+=1 )

if %MISSING_DATA% gtr 0 (
    echo   WARNING: %MISSING_DATA% CSV file(s) missing - run 'npm run ingest:rainfall' and 'npm run ingest:satellite'
)

:: 5. Check Models Load & Predict
echo [5/6] Model prediction test...
cd bahuraksha-api
python -c "
import sys; sys.path.insert(0, '.')
from csv_models import _load_model_bundle, _build_feature_row
from pathlib import Path
f = _load_model_bundle(Path('models/flood_model.pkl'))
l = _load_model_bundle(Path('models/landslide_model.pkl'))

fp = {'lat':27.72,'lon':85.32,'rf_1day':45,'rf_3day':120,'rf_7day':200,'rf_30day':350,'discharge_proxy':1500,'soil_moisture_index':0.65,'elevation_m':1200,'slope_deg':8,'aspect_deg':120,'curvature':0,'sar_vv_db':-14,'sar_vh_db':-20,'sar_vv_vh_ratio_db':6,'date':'2025-06-01'}
ff = _build_feature_row(fp, f['feature_columns'])
fp_prob = float(f['model'].predict_proba(ff)[0,1])
print(f'  Flood prob={fp_prob:.4f}', end='')

lp = {'lat':27.72,'lon':85.32,'rf_1day':45,'rf_3day':120,'rf_7day':200,'rf_30day':350,'elevation_m':1200,'slope_deg':8,'aspect_deg':120,'curvature':0,'landuse_code':50,'ndvi_proxy':0.10,'dist_drainage_m':500,'date':'2025-06-01'}
lf = _build_feature_row(lp, l['feature_columns'])
ls_prob = float(l['model'].predict_proba(lf)[0,1])
print(f', Landslide prob={ls_prob:.4f}')
print('PASS')
" > ..\health_temp.txt 2>&1
cd ..
set /p HEALTH_RESULT=<health_temp.txt
del health_temp.txt
echo   %HEALTH_RESULT%
if not "%HEALTH_RESULT%"=="PASS" (
    echo   FAIL - Models failed to predict
    set /a FAIL+=1
)

:: 6. Check Training Scripts
echo [6/6] Training scripts...
if exist "bahuraksha-api\train_flood_model.py" ( echo   PASS - train_flood_model.py exists ) else ( echo   FAIL - train_flood_model.py missing; set /a FAIL+=1 )
if exist "bahuraksha-api\train_landslide_model.py" ( echo   PASS - train_landslide_model.py exists ) else ( echo   FAIL - train_landslide_model.py missing; set /a FAIL+=1 )

echo.
if %FAIL% equ 0 (
    echo ============================================
    echo   ALL CHECKS PASSED - Demo is production ready
    echo ============================================
) else (
    echo ============================================
    echo   %FAIL% check(s) FAILED
    echo   Fix the issues above before demo
    echo ============================================
)

echo.
pause
