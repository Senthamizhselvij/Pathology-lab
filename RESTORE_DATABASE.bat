@echo off
title Pathology Lab - Database Restore
color 0E
echo ======================================================================
echo             PATHOLOGY LAB - DATABASE RESTORE UTILITY
echo ======================================================================
echo.
echo Available backups in 'backups' folder:
echo ----------------------------------------------------------------------
dir /b /o-d backups\*.sql 2>nul
echo ----------------------------------------------------------------------
echo.
echo Drag and drop your backup .sql file here (or type its name) and press ENTER:
echo (To cancel, close this window)
echo.
set /p SQLFILE="Backup file: "

if "%SQLFILE%"=="" (
    echo No file specified. Cancelled.
    timeout /t 3 >nul
    exit
)

set SQLFILE=%SQLFILE:"=%

if not exist "%SQLFILE%" (
    if exist "backups\%SQLFILE%" (
        set SQLFILE=backups\%SQLFILE%
    ) else (
        echo [ERROR] File not found: %SQLFILE%
        pause
        exit
    )
)

echo.
echo Restoring %SQLFILE% into pathology_lab database...
"C:\xampp\mysql\bin\mysql.exe" -u root pathology_lab < "%SQLFILE%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================================
    echo   SUCCESS! Database has been restored from backup!
    echo ======================================================================
) else (
    echo.
    echo [ERROR] Restore failed. Please ensure MySQL is running in XAMPP.
)
echo.
pause
exit
