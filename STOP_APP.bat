@echo off
echo Stopping Pathology Lab server (port 5000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
echo Done.
timeout /t 2 >nul
