@echo off
echo ========================================
echo   Distinguishable Colormap Generator
echo ========================================
echo.

echo [1/4] Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo Failed to install Python dependencies!
    pause
    exit /b 1
)

echo.
echo [2/4] Starting Flask backend on port 5000...
start "Flask Backend" cmd /k "set FLASK_APP=server.py && flask run -p 5000"

echo.
echo [3/4] Installing frontend dependencies...
cd frontend
if not exist "node_modules" (
    npm install
)

echo.
echo [4/4] Starting React frontend on port 3000...
start "React Frontend" cmd /k "npm run dev"

cd ..

echo.
echo ========================================
echo   Application Started Successfully!
echo ========================================
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo ========================================
echo.
echo Press any key to close this window...
pause > nul
