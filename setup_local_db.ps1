$ErrorActionPreference = 'Stop'

Write-Host "1. SQL Server LoginMode Kayit Defteri Ayari Guncelleniyor..." -ForegroundColor Cyan
Set-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQLServer' -Name 'LoginMode' -Value 2

Write-Host "2. SQL Server (SQLEXPRESS) Servisi Yeniden Baslatiliyor..." -ForegroundColor Cyan
Restart-Service -Name 'MSSQL$SQLEXPRESS' -Force

Write-Host "Servisin hazir olmasi bekleniyor..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "3. 'sa' Kullanicisi Aktif Ediliyor ve Sifresi Belirleniyor..." -ForegroundColor Cyan
sqlcmd -S .\SQLEXPRESS -E -Q "ALTER LOGIN sa WITH PASSWORD = 'Baytemur2026!'; ALTER LOGIN sa ENABLE;"

Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "Islem basariyla tamamlandi!" -ForegroundColor Green
Write-Host "Lokal SQL Server sa kullanici sifresi: Baytemur2026!" -ForegroundColor Green
Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "Cikmak icin Enter tusuna basin..."
Read-Host
