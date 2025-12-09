@echo off
echo ========================================
echo   Distinguishable Colormap Generator
echo ========================================
echo.

echo [1/2] Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo Failed to install Python dependencies!
    pause
    exit /b 1
)

echo.
echo [2/2] Starting Flask Server...
echo.
echo Opening browser...
start http://localhost:5000

echo Starting server process...
set FLASK_APP=server.py
set FLASK_ENV=development
flask run -p 5000

pause
