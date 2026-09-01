Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$script:ProjectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:BatFile = Join-Path $script:ProjectDirectory "server-start.bat"
$script:VbsFile = Join-Path $script:ProjectDirectory "TecDocTray.vbs"
$script:LogFile = Join-Path $script:ProjectDirectory "tecdoc-tray.log"
$script:ServerProcess = $null

function Write-Log {
    param([string]$Message)

    $line = "[$(Get-Date -Format 'dd.MM.yyyy HH:mm:ss')] $Message"

    Add-Content `
        -Path $script:LogFile `
        -Value $line `
        -Encoding UTF8
}

function Get-Port {
    $port = 8088
    $envFile = Join-Path $script:ProjectDirectory ".env"

    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^\s*PORT\s*=\s*["'']?(\d+)') {
                return [int]$Matches[1]
            }
        }
    }

    return $port
}

function Test-ServerRunning {
    if ($null -eq $script:ServerProcess) {
        return $false
    }

    try {
        return -not $script:ServerProcess.HasExited
    }
    catch {
        return $false
    }
}

function Update-Menu {
    $running = Test-ServerRunning

    if ($running) {
        $statusItem.Text = "Durum: Çalışıyor"
        $startItem.Enabled = $false
        $stopItem.Enabled = $true
        $notifyIcon.Text = "TecDoc - Çalışıyor"
    }
    else {
        $statusItem.Text = "Durum: Durduruldu"
        $startItem.Enabled = $true
        $stopItem.Enabled = $false
        $notifyIcon.Text = "TecDoc - Durduruldu"
    }

    $startupItem.Checked = Test-StartupEnabled
}

function Start-Server {
    if (Test-ServerRunning) {
        return
    }

    if (-not (Test-Path $script:BatFile)) {
        [System.Windows.Forms.MessageBox]::Show(
            "server-start.bat bulunamadı.`n`n$script:BatFile",
            "TecDoc",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )

        return
    }

    try {
        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = "cmd.exe"
        $startInfo.Arguments = "/d /c `"`"$script:BatFile`"`""
        $startInfo.WorkingDirectory = $script:ProjectDirectory
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden

        $script:ServerProcess = New-Object System.Diagnostics.Process
        $script:ServerProcess.StartInfo = $startInfo
        $script:ServerProcess.EnableRaisingEvents = $true

        $script:ServerProcess.add_Exited({
            try {
                $menu.BeginInvoke([Action]{
                    $script:ServerProcess = $null
                    Update-Menu

                    $notifyIcon.ShowBalloonTip(
                        3000,
                        "TecDoc",
                        "Sunucu çalışmayı durdurdu.",
                        [System.Windows.Forms.ToolTipIcon]::Warning
                    )
                })
            }
            catch {
            }
        })

        $started = $script:ServerProcess.Start()

        if (-not $started) {
            throw "Sunucu işlemi başlatılamadı."
        }

        Write-Log "Sunucu başlatıldı. PID: $($script:ServerProcess.Id)"
        Update-Menu

        $notifyIcon.ShowBalloonTip(
            2000,
            "TecDoc",
            "Sunucu başlatıldı.",
            [System.Windows.Forms.ToolTipIcon]::Info
        )
    }
    catch {
        Write-Log "Başlatma hatası: $($_.Exception.Message)"

        $script:ServerProcess = $null
        Update-Menu

        [System.Windows.Forms.MessageBox]::Show(
            "Sunucu başlatılamadı.`n`n$($_.Exception.Message)",
            "TecDoc",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
}

function Stop-Server {
    if (-not (Test-ServerRunning)) {
        $script:ServerProcess = $null
        Update-Menu
        return
    }

    try {
        $processId = $script:ServerProcess.Id

        Start-Process `
            -FilePath "taskkill.exe" `
            -ArgumentList "/PID $processId /T /F" `
            -WindowStyle Hidden `
            -Wait

        Write-Log "Sunucu durduruldu. PID: $processId"
    }
    catch {
        Write-Log "Durdurma hatası: $($_.Exception.Message)"
    }

    $script:ServerProcess = $null
    Update-Menu

    $notifyIcon.ShowBalloonTip(
        2000,
        "TecDoc",
        "Sunucu durduruldu.",
        [System.Windows.Forms.ToolTipIcon]::Info
    )
}

function Open-Browser {
    $port = Get-Port
    Start-Process "http://localhost:$port"
}

function Get-StartupShortcut {
    $startupFolder = [Environment]::GetFolderPath("Startup")
    return Join-Path $startupFolder "TecDoc Tray.lnk"
}

function Test-StartupEnabled {
    $shortcutPath = Get-StartupShortcut
    return Test-Path $shortcutPath
}

function Enable-Startup {
    if (-not (Test-Path $script:VbsFile)) {
        [System.Windows.Forms.MessageBox]::Show(
            "TecDocTray.vbs bulunamadı.",
            "TecDoc",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )

        return
    }

    try {
        $shortcutPath = Get-StartupShortcut
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)

        $shortcut.TargetPath = "wscript.exe"
        $shortcut.Arguments = "`"$script:VbsFile`""
        $shortcut.WorkingDirectory = $script:ProjectDirectory
        $shortcut.IconLocation = "shell32.dll,14"
        $shortcut.Save()

        Write-Log "Windows başlangıcına eklendi."
        Update-Menu

        [System.Windows.Forms.MessageBox]::Show(
            "Windows ile otomatik başlatma etkinleştirildi.",
            "TecDoc",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    }
    catch {
        Write-Log "Başlangıç ekleme hatası: $($_.Exception.Message)"

        [System.Windows.Forms.MessageBox]::Show(
            "Başlangıca eklenemedi.`n`n$($_.Exception.Message)",
            "TecDoc",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
}

function Disable-Startup {
    try {
        $shortcutPath = Get-StartupShortcut

        if (Test-Path $shortcutPath) {
            Remove-Item $shortcutPath -Force
        }

        Write-Log "Windows başlangıcından kaldırıldı."
        Update-Menu

        [System.Windows.Forms.MessageBox]::Show(
            "Windows ile otomatik başlatma kapatıldı.",
            "TecDoc",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    }
    catch {
        [System.Windows.Forms.MessageBox]::Show(
            "Başlangıç ayarı değiştirilemedi.`n`n$($_.Exception.Message)",
            "TecDoc",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
}

function Toggle-Startup {
    if (Test-StartupEnabled) {
        Disable-Startup
    }
    else {
        Enable-Startup
    }
}

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$iconFile = Join-Path $PSScriptRoot "app.ico"

if (Test-Path $iconFile) {
    $notifyIcon.Icon = New-Object System.Drawing.Icon($iconFile)
}
else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}
$notifyIcon.Text = "TecDoc"
$notifyIcon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$statusItem = New-Object System.Windows.Forms.ToolStripMenuItem
$statusItem.Text = "Durum: Durduruldu"
$statusItem.Enabled = $false

$startItem = New-Object System.Windows.Forms.ToolStripMenuItem
$startItem.Text = "Sunucuyu Başlat"
$startItem.Add_Click({
    Start-Server
})

$stopItem = New-Object System.Windows.Forms.ToolStripMenuItem
$stopItem.Text = "Sunucuyu Durdur"
$stopItem.Add_Click({
    Stop-Server
})

$browserItem = New-Object System.Windows.Forms.ToolStripMenuItem
$browserItem.Text = "Tarayıcıda Aç"
$browserItem.Add_Click({
    Open-Browser
})

$folderItem = New-Object System.Windows.Forms.ToolStripMenuItem
$folderItem.Text = "Klasörü Aç"
$folderItem.Add_Click({
    Start-Process "explorer.exe" -ArgumentList "`"$script:ProjectDirectory`""
})

$logItem = New-Object System.Windows.Forms.ToolStripMenuItem
$logItem.Text = "Hata Kaydını Aç"
$logItem.Add_Click({
    if (-not (Test-Path $script:LogFile)) {
        Set-Content `
            -Path $script:LogFile `
            -Value "TecDoc hata kayıt dosyası." `
            -Encoding UTF8
    }

    Start-Process "notepad.exe" -ArgumentList "`"$script:LogFile`""
})

$startupItem = New-Object System.Windows.Forms.ToolStripMenuItem
$startupItem.Text = "Windows ile Başlat"
$startupItem.CheckOnClick = $false
$startupItem.Add_Click({
    Toggle-Startup
})

$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
$exitItem.Text = "Çıkış"
$exitItem.Add_Click({
    Stop-Server

    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()

    [System.Windows.Forms.Application]::Exit()
})

[void]$menu.Items.Add($statusItem)
[void]$menu.Items.Add("-")
[void]$menu.Items.Add($startItem)
[void]$menu.Items.Add($stopItem)
[void]$menu.Items.Add($browserItem)
[void]$menu.Items.Add("-")
[void]$menu.Items.Add($startupItem)
[void]$menu.Items.Add($folderItem)
[void]$menu.Items.Add($logItem)
[void]$menu.Items.Add("-")
[void]$menu.Items.Add($exitItem)

$notifyIcon.ContextMenuStrip = $menu

$notifyIcon.Add_DoubleClick({
    Open-Browser
})

Update-Menu
Start-Server

[System.Windows.Forms.Application]::Run()