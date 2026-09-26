<#
  NightCode OS: branding and quiet-Windows settings. Run by firstboot.ps1 (elevated); safe to run again.

    - "NightCode OS" in System > About (maker, model, support link, logo) and in the boot menu
    - the NightCode lock screen / sign-in picture and account picture
    - dark mode; no Windows tips, suggested apps, ads or "finish setting up" nags
    - sensible power settings for a laptop

  Everything here is ordinary Windows settings; nothing is removed from Windows.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$art = Join-Path $Root "art"

function Ensure-Key([string]$Path) { if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null } }
function Set-Reg([string]$Path, [string]$Name, $Value, [string]$Type = "DWord") {
  Ensure-Key $Path
  New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type -Force | Out-Null
}

# ---------- System > About ----------
$oem = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation"
Set-Reg $oem "Manufacturer" "ColeTech Systems" "String"
Set-Reg $oem "Model" "NightCode OS (Windows - ColeForge Edition)" "String"
Set-Reg $oem "SupportURL" "https://nightcode.coletechsystems.com" "String"
Set-Reg $oem "SupportHours" "Code beyond the light" "String"
$logo = Join-Path $art "oem-logo.bmp"
if (Test-Path $logo) {
  $logoDest = Join-Path $env:WINDIR "System32\oobe\info\nightcode-logo.bmp"
  New-Item -ItemType Directory -Force -Path (Split-Path $logoDest) | Out-Null
  Copy-Item -Force $logo $logoDest
  Set-Reg $oem "Logo" $logoDest "String"
}
Write-Host "     System > About says NightCode OS"

# ---------- boot menu ----------
try { & bcdedit.exe /set "{current}" description "NightCode OS" | Out-Null; Write-Host "     boot menu entry: NightCode OS" } catch { Write-Host "     (couldn't rename the boot menu entry)" }

# ---------- lock screen, sign-in and account pictures ----------
$wall = Join-Path $art "nightcode.png"
if (Test-Path $wall) {
  $pub = Join-Path $env:PUBLIC "Pictures\NightCode"
  New-Item -ItemType Directory -Force -Path $pub | Out-Null
  Copy-Item -Force $wall (Join-Path $pub "lockscreen.png")
  $csp = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP"
  Set-Reg $csp "LockScreenImagePath" (Join-Path $pub "lockscreen.png") "String"
  Set-Reg $csp "LockScreenImageUrl" (Join-Path $pub "lockscreen.png") "String"
  Set-Reg $csp "LockScreenImageStatus" 1
  Write-Host "     lock screen: NightCode"
}
$acct = Join-Path $art "account.png"
if (Test-Path $acct) {
  # The default account picture every account starts with.
  $pics = Join-Path $env:ProgramData "Microsoft\User Account Pictures"
  if (Test-Path $pics) { try {
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromFile($acct)
    foreach ($s in @(32, 40, 48, 192, 448)) {
      $bmp = New-Object System.Drawing.Bitmap $img, $s, $s
      $bmp.Save((Join-Path $pics "user-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
    }
    $bmp = New-Object System.Drawing.Bitmap $img, 448, 448
    $bmp.Save((Join-Path $pics "user.png"), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    $img.Dispose()
    Set-Reg "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" "UseDefaultTile" 1
    Write-Host "     account picture: NightCode"
  } catch { Write-Host "     (account picture left as it was: $($_.Exception.Message))" } }
}

# ---------- dark mode, quiet Windows ----------
$personalize = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
Set-Reg $personalize "AppsUseLightTheme" 0
Set-Reg $personalize "SystemUsesLightTheme" 0
Set-Reg $personalize "EnableTransparency" 1
$cdm = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
foreach ($n in @("SilentInstalledAppsEnabled", "SystemPaneSuggestionsEnabled", "SoftLandingEnabled", "RotatingLockScreenEnabled", "RotatingLockScreenOverlayEnabled",
                 "SubscribedContent-310093Enabled", "SubscribedContent-338388Enabled", "SubscribedContent-338389Enabled", "SubscribedContent-338393Enabled",
                 "SubscribedContent-353694Enabled", "SubscribedContent-353696Enabled", "PreInstalledAppsEnabled", "OemPreInstalledAppsEnabled")) {
  Set-Reg $cdm $n 0
}
Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\UserProfileEngagement" "ScoobeSystemSettingEnabled" 0      # "Let's finish setting up"
Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent" "DisableWindowsConsumerFeatures" 1
Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent" "DisableSoftLanding" 1
Set-Reg "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" "AllowTelemetry" 1                          # "Required" only
Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo" "Enabled" 0
Set-Reg "HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy" "TailoredExperiencesWithDiagnosticDataEnabled" 0
Write-Host "     dark mode on; tips, suggested apps and ads off"

# ---------- power ----------
try {
  & powercfg.exe /change monitor-timeout-ac 20 | Out-Null
  & powercfg.exe /change monitor-timeout-dc 10 | Out-Null
  & powercfg.exe /change standby-timeout-ac 60 | Out-Null
  & powercfg.exe /change standby-timeout-dc 20 | Out-Null
  Write-Host "     power: screen off after 20 min plugged in / 10 on battery"
} catch { Write-Host "     (power settings left as they were)" }
