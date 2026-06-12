@echo off
chcp 65001 >nul
title SEMENT - Ishga tushirish
cd /d "%~dp0"

echo ================================================
echo    SEMENT BIZNES BOSHQARUVI
echo ================================================
echo.

if not exist "backend\node_modules" (
  echo [1] Backend paketlari ornatilmoqda... faqat birinchi marta, kuting...
  cd backend
  call npm install
  cd ..
)
if not exist "dashboard\node_modules" (
  echo [2] Dashboard paketlari ornatilmoqda... faqat birinchi marta, kuting...
  cd dashboard
  call npm install
  cd ..
)

echo [3] Serverlar ishga tushirilmoqda...
start "SEMENT Backend"   cmd /k "cd /d %~dp0backend && npm start"
start "SEMENT Dashboard" cmd /k "cd /d %~dp0dashboard && npm run dev"

echo.
echo Brauzer 6 soniyadan keyin avtomatik ochiladi...
timeout /t 6 >nul
start "" http://localhost:5173

echo.
echo Tayyor! Agar brauzer ochilmasa, qulda oching: http://localhost:5173
echo Dasturni toxtatish uchun ochilgan ikkala qora oynani yoping.
echo Bu oynani yopsangiz boladi.
pause >nul
