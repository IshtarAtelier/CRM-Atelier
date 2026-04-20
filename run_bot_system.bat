@echo off
echo ======================================================
echo    STARTING ATELIER CRM BOT SYSTEM
echo ======================================================

echo [1/3] Starting Main CRM (Frontend & API)...
start cmd /k "npm run dev"

timeout /t 5

echo [2/3] Starting Bot Brain (LangGraph Service)...
start cmd /k "cd bot-service && node index.js"

timeout /t 2

echo [3/3] Starting WhatsApp Connector...
start cmd /k "node scripts/whatsapp-server.js"

echo ======================================================
echo   ALL SERVICES STARTING! 
echo   - CRM: http://localhost:3000
echo   - WhatsApp UI: http://localhost:3000/whatsapp
echo ======================================================
pause
