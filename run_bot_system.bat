@echo off
echo ======================================================
echo    STARTING ATELIER CRM BOT SYSTEM
echo ======================================================

echo [1/2] Starting Main CRM (Frontend & API)...
start cmd /k "npm run dev"

timeout /t 5

echo [2/2] Starting Unified WhatsApp Bot (wa-service)...
start cmd /k "cd wa-service && npm run dev"

echo ======================================================
echo   ALL SERVICES STARTING! 
echo   - CRM: http://localhost:3000
echo   - WhatsApp UI: http://localhost:3000/whatsapp
echo ======================================================
pause
