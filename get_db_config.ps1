$ErrorActionPreference = 'Stop'
$accessCandidates = @(
    "$PSScriptRoot\1a.accdb",
    "$PSScriptRoot\..\1a.accdb"
)
$accessPath = $null
foreach ($candidate in $accessCandidates) {
    if (Test-Path $candidate) {
        $accessPath = (Resolve-Path $candidate).Path
        break
    }
}
if (-not $accessPath) { throw '1a.accdb bulunamadı.' }
$connection = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$accessPath;Persist Security Info=False;")
$connection.Open()
try {
    $command = $connection.CreateCommand()
    $command.CommandText = @'
SELECT TOP 1 ODBC_Server, ODBC_Datenbank, ODBC_User, ODBC_Passwort
FROM MSysODBC_Umgebungen
WHERE UCase(ODBC_User)='SA' AND Inaktiv_JN=False
  AND DBBereich='Hauptdatenbank' AND Selected=True
ORDER BY oID
'@
    $reader = $command.ExecuteReader()
    if (-not $reader.Read()) { throw 'Aktif ana veritabanı bağlantısı bulunamadı.' }
    [pscustomobject]@{ server=[string]$reader['ODBC_Server']; database=[string]$reader['ODBC_Datenbank']; user=[string]$reader['ODBC_User']; password=[string]$reader['ODBC_Passwort'] } | ConvertTo-Json -Compress
    $reader.Close()
}
finally { $connection.Close() }
