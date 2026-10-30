@echo off
title Pathology Lab - Start
cd /d "%~dp0"
if exist "C:\xampp\mysql_start.bat" start "" "C:\xampp\mysql_start.bat"
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
if not exist "node_modules" call npm run install:all
if not exist "frontend\dist\index.html" call npm run build
echo Starting server... (close the new window to stop)
start "Pathology Lab Server" cmd /k "npm start"
timeout /t 5 /nobreak >nul
start "" "http://localhost:5000"
