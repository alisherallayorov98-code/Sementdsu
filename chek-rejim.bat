@echo off
chcp 65001 >nul
title SEMENT - Chek rejimi (avtomatik chop etish)

REM ============================================================
REM  Bu fayl saytni Chrome'ning "kiosk-printing" rejimida ochadi.
REM  Shu rejimda chek CHOP ETISH OYNASISIZ, to'g'ridan-to'g'ri
REM  STANDART printerga (X-printer) jim chiqadi.
REM
REM  TAYYORGARLIK (bir martalik):
REM   1) X-printer (termal printer) Windows'ga o'rnatilgan bo'lsin.
REM   2) Boshqarish paneli > Printerlar > X-printerni "Default" qiling.
REM   3) Avval start.bat bilan saytni ishga tushiring.
REM   4) Keyin shu faylni (chek-rejim.bat) bosing.
REM ============================================================

set URL=http://localhost:5173

set CHROME=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe

if "%CHROME%"=="" (
  echo Chrome topilmadi! Iltimos Google Chrome o'rnating.
  echo Yoki boshqa brauzerda http://localhost:5173 ni oching.
  pause
  exit /b
)

echo Chek rejimida ochilmoqda...
start "" "%CHROME%" --kiosk-printing --new-window "%URL%"
echo Tayyor! Endi har bir sotuvdan keyin chek avtomatik chiqadi.
timeout /t 3 >nul
