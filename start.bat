@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===================================================
echo   TecDoc Parca Arama - Baslatici ve Bagimlilik Kurucu
echo ===================================================
echo.

:: 1. Sistemde Node.js var mi kontrol et
where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "NODE_BIN=node"
    set "NPM_BIN=npm"
    echo [INFO] Sistemde kurulu Node.js tespit edildi.
) else (
    echo [INFO] Sistemde Node.js bulunamadi. Portable Tasinabilir Node.js kontrol ediliyor...
    set "PORTABLE_DIR=%~dp0.node"
    set "NODE_BIN=!PORTABLE_DIR!\node.exe"
    set "NPM_BIN=!PORTABLE_DIR!\npm.cmd"
    
    if not exist "!NODE_BIN!" (
        echo [INFO] Portable Node.js bulunamadi. Internetten indiriliyor...
        echo [INFO] Bu islem sadece ilk calistirmada bir defa yapilir ve birkac dakika surebilir.
        
        powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Write-Host 'Indiriliyor: Node.js v20.11.0...' -ForegroundColor Cyan; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip' -OutFile '%~dp0node.zip'; Write-Host 'Arsiv aciliyor...' -ForegroundColor Cyan; Expand-Archive -Path '%~dp0node.zip' -DestinationPath '%~dp0.node_temp'; Copy-Item -Path '%~dp0.node_temp\node-v20.11.0-win-x64\*' -Destination '%~dp0.node\' -Recurse -Force; Remove-Item '%~dp0.node_temp' -Recurse -Force; Remove-Item '%~dp0node.zip' -Force; Write-Host 'Node.js basariyla hazirlandi.' -ForegroundColor Green"
             
        if not exist "!NODE_BIN!" (
            echo [ERROR] Node.js indirilemedi veya kurulamadi. Lutfen internet baglantinizi kontrol edin.
            pause
            exit /b 1
        )
    ) else (
        echo [INFO] Portable Node.js hazir.
    )
)

:: 2. Bagimliliklar node_modules yuklu mu kontrol et
set "INSTALL_NEEDED=0"
if not exist "node_modules\" set "INSTALL_NEEDED=1"
if not exist "node_modules\fastify\" set "INSTALL_NEEDED=1"
if not exist "node_modules\mssql\" set "INSTALL_NEEDED=1"
if not exist "node_modules\dotenv\" set "INSTALL_NEEDED=1"

if "!INSTALL_NEEDED!"=="1" (
    echo [INFO] Eksik paketler tespit edildi veya node_modules bulunamadi. Bagimliliklar kuruluyor...
    if "!NODE_BIN!"=="node" (
        call npm install
    ) else (
        call "!NPM_BIN!" install
    )
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Bagimliliklar yuklenirken bir hata olustu.
        pause
        exit /b 1
    )
) else (
    echo [INFO] Tum gerekli bagimliliklar kurulu ve hazir.
)

:: 3. Port degerini .env dosyasindan oku
set "PORT=8088"
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
        if "%%A"=="PORT" set "PORT=%%B"
    )
)

:: 4. Tarayiciyi baslat ve sunucuyu ac
echo [INFO] Sunucu baslatiliyor...
start "" "http://localhost:%PORT%"
call "!NODE_BIN!" index.js

pause
