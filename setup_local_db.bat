@echo off
cd /d "%~dp0"
echo Admin yetkisi talep ediliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0setup_local_db.ps1\"'"
