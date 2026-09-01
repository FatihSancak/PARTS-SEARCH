$ErrorActionPreference = 'Stop'
$ruleName = 'TecDoc Search Intranet 8088'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existing) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8088 -RemoteAddress LocalSubnet -Profile Private | Out-Null
}
else {
    Set-NetFirewallRule -DisplayName $ruleName -Enabled True -Direction Inbound -Action Allow -Profile Private
    Set-NetFirewallAddressFilter -AssociatedNetFirewallRule $existing -RemoteAddress LocalSubnet
}
Write-Host 'Intranet erişimi hazır: TCP 8088, yalnızca LocalSubnet / Private profil.' -ForegroundColor Green
Read-Host 'Kapatmak için Enter'
