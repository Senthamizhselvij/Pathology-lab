@echo off
title Pathology Lab - 1-Click Database Backup
color 0B
echo ======================================================================
echo             PATHOLOGY LAB - 1-CLICK DATABASE BACKUP
echo ======================================================================
echo.

if not exist "backups" mkdir "backups"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I
set YYYY=%dt:~0,4%
set MM=%dt:~4,2%
set DD=%dt:~6,2%
set HH=%dt:~8,2%
set Min=%dt:~10,2%
set Sec=%dt:~12,2%
set STAMP=%YYYY%-%MM%-%DD%_%HH%-%Min%-%Sec%
set BACKUP_FILE=backups\pathology_lab_backup_%STAMP%.sql

echo Backing up live database (patients, tests, reports)...
"C:\xampp\mysql\bin\mysqldump.exe" -u root pathology_lab > "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================================
    echo   SUCCESS! Full database backup saved to:
    echo   %CD%\%BACKUP_FILE%
    echo ======================================================================
) else (
    echo.
    echo [ERROR] Backup failed. Please ensure MySQL is running in XAMPP.
)

echo.
timeout /t 5 >nul
exit
