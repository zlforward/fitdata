@echo off
chcp 65001 >nul
echo ====================================
echo     FitData Visualizer Local Start
echo ====================================
echo.

echo Checking Node.js environment...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js not detected
    echo Please install Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js environment check passed
echo.

echo Entering project directory...
cd /d "%~dp0fitdata-visualizer"

echo Checking if dependencies are installed...
if not exist "node_modules" (
    echo Installing project dependencies...
    echo Note: First run requires internet connection
    npm install
    if %errorlevel% neq 0 (
        echo Dependency installation failed, please check network
        pause
        exit /b 1
    )
    echo Dependencies installed successfully
) else (
    echo Dependencies exist, skipping installation
)

echo.
echo Starting development server...
echo Browser will open automatically after server starts
echo Access URL: http://localhost:3000
echo.
echo Press Ctrl+C to stop server
echo ====================================
echo.

npm start

echo.
echo Server stopped
pause