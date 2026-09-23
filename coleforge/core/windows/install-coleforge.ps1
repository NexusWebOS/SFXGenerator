<#
  Windows – ColeForge Edition: make ColeForge the shell for the current Windows user.

  Runs per-user (HKCU), no admin needed, and is fully reversible with uninstall-coleforge.ps1.
  Windows keeps its real NT kernel and drivers (GPU, Wi-Fi, webcam, USB); ColeForge replaces
  explorer.exe as the desktop, and installs its sound scheme and wallpaper.

  Usage (PowerShell):
    Set-ExecutionPolicy -Scope Process Bypass
    .\install-coleforge.ps1                                  # default install location
    .\install-coleforge.ps1 -ExePath "D:\ColeForge\ColeForge.exe"
    .\install-coleforge.ps1 -ThemeOnly                       # sounds + wallpaper, keep Explorer
    .\install-coleforge.ps1 -Scheme Classic                  # synth sounds instead of the ElevenLabs set

  Escape hatch if anything goes wrong: Ctrl+Shift+Esc -> File -> Run new task -> explorer.exe,
  then run uninstall-coleforge.ps1.
#>
[CmdletBinding()]
param(
  [string]$ExePath = "$env:LOCALAPPDATA\Programs\ColeForge\ColeForge.exe",
  [string]$AssetsPath = "",
  [ValidateSet("Studio", "Classic")][string]$Scheme = "Studio",
  [switch]$ThemeOnly
)
$ErrorActionPreference = "Stop"

if (-not $AssetsPath) {
  $candidates = @(
    (Join-Path (Split-Path $ExePath) "resources\coleforge-assets"),
    (Join-Path $PSScriptRoot "..\..\shell\assets")
  )
  $AssetsPath = $candidates | Where-Object { Test-Path (Join-Path $_ "sounds\startup.wav") } | Select-Object -First 1
}
if (-not $AssetsPath) { throw "Couldn't find ColeForge assets (sounds). Pass -AssetsPath <folder containing sounds\>." }
if (-not $ThemeOnly -and -not (Test-Path $ExePath)) { throw "ColeForge.exe not found at $ExePath. Install ColeForge first or pass -ExePath." }

# New-Item -Force would recreate (wipe) an existing registry key, so only create missing keys.
function Ensure-Key([string]$Path) { if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null } }

$cfHome = Join-Path $env:APPDATA "ColeForge"
$media = Join-Path $cfHome "Media"
New-Item -ItemType Directory -Force -Path $media | Out-Null
$soundSrc = if ($Scheme -eq "Studio") { "sounds\studio\*.wav" } else { "sounds\*.wav" }
Copy-Item -Force (Join-Path $AssetsPath $soundSrc) $media
Write-Host "Copied ColeForge $Scheme sounds to $media"

# ---------- sound scheme ----------
$schemeKey = "ColeForge"
Ensure-Key "HKCU:\AppEvents\Schemes\Names\$schemeKey"
Set-ItemProperty -Path "HKCU:\AppEvents\Schemes\Names\$schemeKey" -Name "(default)" -Value "ColeForge $Scheme"
$events = @{
  ".Default\.Default"               = "ding"
  ".Default\SystemAsterisk"         = "ding"
  ".Default\SystemExclamation"      = "exclamation"
  ".Default\SystemHand"             = "critical_stop"
  ".Default\SystemQuestion"         = "question"
  ".Default\SystemNotification"     = "notify"
  ".Default\Notification.Default"   = "notify"
  ".Default\WindowsLogon"           = "logon"
  ".Default\SystemStart"            = "startup"
  ".Default\SystemExit"             = "shutdown"
  ".Default\WindowsLogoff"          = "shutdown"
  ".Default\MenuCommand"            = "menu_click"
  ".Default\MenuPopup"              = "menu_popup"
  ".Default\Minimize"               = "minimize"
  ".Default\Maximize"               = "maximize"
  ".Default\RestoreUp"              = "maximize"
  ".Default\DeviceConnect"          = "buddy_in"
  ".Default\DeviceDisconnect"       = "buddy_out"
  "Explorer\EmptyRecycleBin"        = "recycle"
}
foreach ($e in $events.GetEnumerator()) {
  $wav = Join-Path $media ($e.Value + ".wav")
  foreach ($slot in @($schemeKey, ".Current")) {
    $key = "HKCU:\AppEvents\Schemes\Apps\$($e.Key)\$slot"
    Ensure-Key $key
    Set-ItemProperty -Path $key -Name "(default)" -Value $wav
  }
}
Set-ItemProperty -Path "HKCU:\AppEvents\Schemes" -Name "(default)" -Value $schemeKey
Write-Host "Installed the 'ColeForge $Scheme' sound scheme."

# ---------- wallpaper ----------
$wallSrc = @("art\wallpapers\lake.png", "art\wallpapers\energy.png", "art\boot-splash.webp") | ForEach-Object { Join-Path $AssetsPath $_ } | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($wallSrc) {
  $wall = Join-Path $cfHome ("wallpaper" + [IO.Path]::GetExtension($wallSrc))
  Copy-Item -Force $wallSrc $wall
  Add-Type @"
using System.Runtime.InteropServices;
public static class CFWall { [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int SystemParametersInfo(int a, int b, string c, int d); }
"@
  [void][CFWall]::SystemParametersInfo(20, 0, $wall, 3)
  Write-Host "Wallpaper set to $wall"
}

if ($ThemeOnly) { Write-Host "Theme installed. Explorer is still your shell."; return }

# ---------- shell replacement (per-user) ----------
$winlogon = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon"
$backupKey = "HKCU:\Software\ColeForge"
Ensure-Key $backupKey
$previous = (Get-ItemProperty -Path $winlogon -Name Shell -ErrorAction SilentlyContinue).Shell
if ($null -eq $previous) { $previous = "" }
if (-not (Get-ItemProperty -Path $backupKey -Name PreviousShell -ErrorAction SilentlyContinue)) {
  Set-ItemProperty -Path $backupKey -Name PreviousShell -Value $previous
}
Set-ItemProperty -Path $winlogon -Name Shell -Value "`"$ExePath`" --shell"
Write-Host ""
Write-Host "ColeForge is now your shell. Sign out and back in (or restart) to boot into it." -ForegroundColor Cyan
Write-Host "Escape hatch: Ctrl+Shift+Esc -> File -> Run new task -> explorer.exe" -ForegroundColor Yellow
Write-Host "Undo:         .\uninstall-coleforge.ps1"
