<#
  Windows – ColeForge Edition: install the Legacy Mode engines.

    DOSBox – ColeForge Edition  = DOSBox Staging (official Windows build) + ColeForge's presets
    Voodoo3 / Windows 98 PCs    = 86Box (official Windows build) + its ROM set

  Everything goes to %LOCALAPPDATA%\ColeForge\legacy\engines, where ColeForge's Legacy Mode
  app looks for it. Downloads come from each project's GitHub releases; nothing is bundled.

  Usage (PowerShell):
    Set-ExecutionPolicy -Scope Process Bypass
    .\get-legacy-engines.ps1                     # DOSBox Staging + 86Box + 86Box ROMs
    .\get-legacy-engines.ps1 -Only DOSBox        # just one of them (DOSBox | 86Box)
    .\get-legacy-engines.ps1 -EnableDirectPlay   # (admin) Windows' legacy DirectPlay for old multiplayer games
#>
[CmdletBinding()]
param(
  [ValidateSet("All", "DOSBox", "86Box")][string]$Only = "All",
  [string]$Dest = (Join-Path $env:LOCALAPPDATA "ColeForge\legacy\engines"),
  [switch]$EnableDirectPlay
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$headers = @{ "User-Agent" = "ColeForge-Legacy-Mode"; "Accept" = "application/vnd.github+json" }

function Get-LatestRelease([string]$Repo) {
  Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/$Repo/releases/latest"
}

function Expand-Download([string]$Url, [string]$Target, [switch]$Flatten) {
  $zip = Join-Path $env:TEMP ([IO.Path]::GetFileName(([Uri]$Url).AbsolutePath) + ".zip")
  Write-Host "  downloading $Url"
  Invoke-WebRequest -UseBasicParsing -Headers @{ "User-Agent" = "ColeForge-Legacy-Mode" } -Uri $Url -OutFile $zip
  if (Test-Path $Target) { Remove-Item -Recurse -Force $Target }
  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  Expand-Archive -Force -Path $zip -DestinationPath $Target
  # Source-style zips wrap everything in one top-level folder; lift its contents up.
  $items = @(Get-ChildItem -Path $Target)
  if ($Flatten -and $items.Count -eq 1 -and $items[0].PSIsContainer) {
    Get-ChildItem -Force -Path $items[0].FullName | Move-Item -Destination $Target
    Remove-Item -Recurse -Force $items[0].FullName
  }
  Remove-Item -Force $zip
}

function Pick-Asset($Release, [string[]]$Patterns) {
  foreach ($p in $Patterns) {
    $hit = $Release.assets | Where-Object { $_.name -match $p -and $_.name -notmatch "(?i)debug|symbols|pdb" } | Select-Object -First 1
    if ($hit) { return $hit }
  }
  return $null
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

if ($Only -in @("All", "DOSBox")) {
  Write-Host "DOSBox Staging (DOSBox – ColeForge Edition engine)"
  $rel = Get-LatestRelease "dosbox-staging/dosbox-staging"
  $asset = Pick-Asset $rel @('(?i)windows.*(x64|x86_64|amd64).*\.zip$', '(?i)windows.*\.zip$')
  if (-not $asset) { throw "No Windows zip in DOSBox Staging $($rel.tag_name). Download it from https://www.dosbox-staging.org and unzip it to $Dest\dosbox-staging" }
  Expand-Download $asset.browser_download_url (Join-Path $Dest "dosbox-staging") -Flatten
  Write-Host "  installed DOSBox Staging $($rel.tag_name)"
}

if ($Only -in @("All", "86Box")) {
  Write-Host "86Box (Windows 98 PCs, Voodoo3 mode)"
  $rel = Get-LatestRelease "86Box/86Box"
  $asset = Pick-Asset $rel @('(?i)windows.*64.*\.zip$', '(?i)win.*64.*\.zip$', '(?i)windows.*\.zip$')
  if (-not $asset) { throw "No Windows zip in 86Box $($rel.tag_name). Download it from https://86box.net and unzip it to $Dest\86box" }
  Expand-Download $asset.browser_download_url (Join-Path $Dest "86box")
  # 86Box needs its ROM set (BIOSes, video BIOSes) in a 'roms' folder next to 86Box.exe.
  $roms = Get-LatestRelease "86Box/roms"
  $romZip = Pick-Asset $roms @('(?i)\.zip$')
  $romUrl = if ($romZip) { $romZip.browser_download_url } else { $roms.zipball_url }
  $romTmp = Join-Path $env:TEMP "cf-86box-roms"
  Expand-Download $romUrl $romTmp -Flatten
  $romDest = Join-Path $Dest "86box\roms"
  if (Test-Path $romDest) { Remove-Item -Recurse -Force $romDest }
  Move-Item $romTmp $romDest
  Write-Host "  installed 86Box $($rel.tag_name) with ROM set $($roms.tag_name)"
}

if ($EnableDirectPlay) {
  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $admin) { Write-Warning "-EnableDirectPlay needs an elevated PowerShell; skipped." }
  else {
    Enable-WindowsOptionalFeature -Online -FeatureName DirectPlay -All -NoRestart | Out-Null
    Write-Host "Enabled Windows' legacy DirectPlay component."
  }
}

Write-Host ""
Write-Host "Done. Open Legacy Mode in ColeForge. For the Voodoo3 rig you'll also need your own"
Write-Host "Windows 98 SE CD image and the 3dfx Voodoo3 Windows 98 driver to install inside it."
