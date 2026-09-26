<#
  NightCode OS: first-time setup. Runs once, at the first sign-in after Windows Setup (from the answer file's
  FirstLogonCommands), from C:\NightCode:

    1. installs ColeForge (installers\ColeForge-*.exe, silently, for this user)
    2. mode "app" (default): NightCode starts full screen at every sign-in, on top of Windows' own desktop
       (Windows keeps its taskbar, Wi-Fi and Settings underneath); mode "shell": ColeForge replaces
       explorer.exe. Either way with the NightCode sounds and wallpaper (core\windows\install-coleforge.ps1)
    3. applies the NightCode OS branding and privacy settings (nightcode-tweaks.ps1)
    4. optionally installs Python and builds Netcon / Disk Dude, and fetches the game engines
    5. removes the password Setup left behind, then restarts straight into NightCode

  Settings come from nightcode.json (written by Make-NightCodeUSB.ps1). Safe to run again:
    powershell -ExecutionPolicy Bypass -File C:\NightCode\firstboot.ps1
  Log: C:\NightCode\logs\firstboot.log
#>
[CmdletBinding()]
param([switch]$NoRestart)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

# Machine-wide settings need an elevated PowerShell (the first-sign-in run already is one).
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"")
  if ($NoRestart) { $argList += "-NoRestart" }
  Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $argList
  return
}
New-Item -ItemType Directory -Force -Path (Join-Path $Root "logs") | Out-Null
Start-Transcript -Path (Join-Path $Root "logs\firstboot.log") -Append | Out-Null
try { $Host.UI.RawUI.WindowTitle = "NightCode OS setup" } catch { }

$config = @{ autoLogon = $false; python = $true; games = $false; scheme = "NightCode"; mode = "app" }
$cfgFile = Join-Path $Root "nightcode.json"
if (Test-Path $cfgFile) {
  (Get-Content $cfgFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $config[$_.Name] = $_.Value }
}

function Banner {
  Clear-Host
  $art = @(
    "   _   _ _       _     _    ____          _         ___  ____  ",
    "  | \ | (_) __ _| |__ | |_ / ___|___   __| | ___   / _ \/ ___| ",
    "  |  \| | |/ _`` | '_ \| __| |   / _ \ / _`` |/ _ \ | | | \___ \ ",
    "  | |\  | | (_| | | | | |_| |__| (_) | (_| |  __/ | |_| |___) |",
    "  |_| \_|_|\__, |_| |_|\__|\____\___/ \__,_|\___|  \___/|____/ ",
    "           |___/          code beyond the light                "
  )
  $art | ForEach-Object { Write-Host $_ -ForegroundColor Cyan }
  Write-Host ""
  Write-Host "  Setting up your NightCode laptop. This takes a few minutes; please leave it running." -ForegroundColor White
  Write-Host ""
}
$steps = New-Object System.Collections.ArrayList
function Step([string]$name, [scriptblock]$body, [switch]$Optional) {
  Write-Host ("  >> " + $name) -ForegroundColor Cyan
  try {
    & $body
    [void]$steps.Add("  [ OK ] $name")
    Write-Host "     done" -ForegroundColor Green
  } catch {
    [void]$steps.Add(("  [" + $(if ($Optional) { "SKIP" } else { "FAIL" }) + "] $name : " + $_.Exception.Message))
    Write-Host ("     " + $_.Exception.Message) -ForegroundColor $(if ($Optional) { "Yellow" } else { "Red" })
    if (-not $Optional) { throw }
  }
}
function Wait-Network([int]$seconds = 180) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try { if (Test-Connection -ComputerName "github.com" -Count 1 -Quiet -ErrorAction Stop) { return $true } } catch { }
    Start-Sleep -Seconds 5
  }
  return $false
}
function Get-Winget {
  $w = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $w) {
    # On a brand-new install App Installer may not be registered for this user yet.
    try { Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe -ErrorAction Stop } catch { }
    Start-Sleep -Seconds 5
    $w = Get-Command winget -ErrorAction SilentlyContinue
  }
  if (-not $w) { throw "winget isn't ready yet (Windows Update will bring it); run firstboot.ps1 again later for the extras." }
  return $w.Source
}

Banner
$exe = Join-Path $env:LOCALAPPDATA "Programs\ColeForge\ColeForge.exe"
$failed = $false
try {
  Step "Installing ColeForge" {
    if (Test-Path $exe) { Write-Host "     already installed"; return }
    $installer = Get-ChildItem (Join-Path $Root "installers") -Filter "ColeForge*.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $installer) { throw "No ColeForge installer in $Root\installers (make the USB again with the installer, or copy ColeForge-Setup.exe there)." }
    $p = Start-Process -FilePath $installer.FullName -ArgumentList "/S", "/currentuser" -PassThru -Wait
    for ($i = 0; $i -lt 60 -and -not (Test-Path $exe); $i++) { Start-Sleep -Seconds 2 }
    if (-not (Test-Path $exe)) { throw "The installer finished (exit $($p.ExitCode)) but ColeForge.exe isn't at $exe." }
  }

  if ($config.mode -eq "shell") {
    Step "Making NightCode the Windows shell (sounds, wallpaper)" {
      & (Join-Path $Root "coleforge\core\windows\install-coleforge.ps1") -ExePath $exe -Scheme $config.scheme
    }
  } else {
    Step "Starting NightCode full screen at every sign-in (sounds, wallpaper)" {
      & (Join-Path $Root "coleforge\core\windows\install-coleforge.ps1") -ExePath $exe -Scheme $config.scheme -ThemeOnly
      $run = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
      if (-not (Test-Path $run)) { New-Item -Path $run -Force | Out-Null }
      Set-ItemProperty -Path $run -Name "NightCode" -Value "`"$exe`" --fullscreen"
      # A desktop shortcut too, for when you close it.
      $lnk = Join-Path ([Environment]::GetFolderPath("Desktop")) "NightCode.lnk"
      $ws = New-Object -ComObject WScript.Shell
      $sc = $ws.CreateShortcut($lnk); $sc.TargetPath = $exe; $sc.Arguments = "--fullscreen"; $sc.WorkingDirectory = (Split-Path $exe); $sc.Save()
    }
  }

  Step "NightCode OS branding and settings" {
    & (Join-Path $Root "nightcode-tweaks.ps1")
  }

  $online = Wait-Network 120
  if (-not $online) { Write-Host "  (no internet yet: skipping the downloads; run firstboot.ps1 again once you're online)" -ForegroundColor Yellow }

  if ($config.python -and $online) {
    Step "Python and the NightCode programs (Netcon, Disk Dude)" -Optional {
      if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
        $winget = Get-Winget
        & $winget install -e --id Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements | Out-Host
        $env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine")
      }
      if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw "Python didn't install." }
      $src = Join-Path (Split-Path $exe) "resources\app.asar.unpacked\app\programs\retro-tools"
      & (Join-Path $Root "coleforge\core\windows\build-nightcode-programs.ps1") -Source $src
    }
  }
  if ($config.games -and $online) {
    Step "Game engines for the Forge Arcade" -Optional {
      & (Join-Path $Root "coleforge\core\windows\get-zandronum.ps1")
      & (Join-Path $Root "coleforge\core\windows\get-legacy-engines.ps1")
    }
  }

  Step "Cleaning up Setup's leftovers" {
    # Setup keeps copies of the answer file, which hold the password in plain text.
    foreach ($f in @("$env:WINDIR\Panther\unattend.xml", "$env:WINDIR\Panther\Unattend\unattend.xml", "$env:WINDIR\System32\Sysprep\unattend.xml")) {
      if (Test-Path $f) { Remove-Item -Force $f -ErrorAction SilentlyContinue }
    }
    $wl = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
    if (-not $config.autoLogon) {
      Set-ItemProperty -Path $wl -Name AutoAdminLogon -Value "0"
      Remove-ItemProperty -Path $wl -Name DefaultPassword -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path $wl -Name AutoLogonCount -ErrorAction SilentlyContinue
    }
  }
} catch {
  $failed = $true
}

Write-Host ""
$steps | ForEach-Object { Write-Host $_ -ForegroundColor $(if ($_ -like "*OK*") { "Green" } elseif ($_ -like "*SKIP*") { "Yellow" } else { "Red" }) }
Write-Host ""
if ($failed) {
  Write-Host "  Setup stopped on an error (details above and in C:\NightCode\logs\firstboot.log)." -ForegroundColor Red
  Write-Host "  Fix it and run:  powershell -ExecutionPolicy Bypass -File C:\NightCode\firstboot.ps1" -ForegroundColor Yellow
  Stop-Transcript | Out-Null
  Read-Host "  Press Enter to close"
  exit 1
}
Set-Content -Path (Join-Path $Root "logs\firstboot.done") -Value (Get-Date -Format s)
Write-Host "  NightCode OS is ready." -ForegroundColor Cyan
if ($config.mode -eq "shell") { Write-Host "  Escape hatch, if you ever need Windows' own desktop: Ctrl+Shift+Esc > Run new task > explorer.exe" -ForegroundColor DarkGray }
else { Write-Host "  NightCode opens full screen at sign-in. F11 makes it a window; the Windows key shows Windows' taskbar." -ForegroundColor DarkGray }
Stop-Transcript | Out-Null
if (-not $NoRestart) {
  Write-Host "  Restarting into NightCode in 15 seconds..." -ForegroundColor White
  shutdown.exe /r /t 15 /c "NightCode OS is ready. Restarting into NightCode." | Out-Null
}
