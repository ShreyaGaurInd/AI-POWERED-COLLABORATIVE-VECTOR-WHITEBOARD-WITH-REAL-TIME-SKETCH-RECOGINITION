@echo off
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

echo ==================================================
echo Starting CollabWhiteboard (Server and Client)...
echo ==================================================

start "CollabWhiteboard Backend" cmd /k "cd /d %~dp0server && npm run dev"
start "CollabWhiteboard Frontend" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo Both servers are launching!
echo Frontend will be available at: http://localhost:5173
echo Backend API will be available at: http://localhost:5000/api
echo.
