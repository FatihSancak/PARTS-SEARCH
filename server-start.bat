@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo TecDoc sunucusu hazırlanıyor...

if not exist "index.js" (
    echo HATA: index.js bulunamadı.
    timeout /t 10
    exit /b 1
)

if not exist "node_modules\" (
    echo Paketler kuruluyor...
    call npm install

    if errorlevel 1 (
        echo HATA: npm install başarısız oldu.
        timeout /t 10
        exit /b 1
    )
)

echo Sunucu başlatılıyor...
node index.js