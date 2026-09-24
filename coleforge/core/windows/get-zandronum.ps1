<#
  Windows – ColeForge Edition: download and install Zandronum (online Doom) for Forge Arcade,
  ForgeChat lobbies and the Forge Game Browser.

  Downloads the official Windows build from zandronum.com (nothing is bundled with ColeForge),
  unpacks it to %LOCALAPPDATA%\ColeForge\games\zandronum and puts that folder on your user PATH,
  so ColeForge can start "zandronum" without any extra configuration.

  Usage (PowerShell):
    Set-ExecutionPolicy -Scope Process Bypass
    .\get-zandronum.ps1                                  # newest Windows build from zandronum.com/download
    .\get-zandronum.ps1 -Zip "$HOME\Downloads\zandronum3.2.1-win64-base.zip"   # a zip you already have
    .\get-zandronum.ps1 -Url "https://zandronum.com/downloads/<file>.zip"      # a specific build
    .\get-zandronum.ps1 -Firewall                        # also open UDP 10666 + 15101 (run as admin)

  Then copy doom2.wad (or the free freedoom2.wad) into the install folder.
#>
[CmdletBinding()]
param(
  [string]$Url = "",
  [string]$Zip = "",
  [string]$Dest = (Join-Path $env:LOCALAPPDATA "ColeForge\games\zandronum"),
  [switch]$NoPath,
  [switch]$Firewall
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $Zip) {
  if (-not $Url) {
    # Find the newest Windows zip linked from the download page (64-bit preferred).
    $page = "https://zandronum.com/download"
    Write-Host "Looking for the latest Windows build on $page ..."
    $html = (Invoke-WebRequest -UseBasicParsing -Uri $page).Content
    $links = [regex]::Matches($html, 'href="([^"]*zandronum[0-9.]+-win(64|32)-base\.zip)"', "IgnoreCase") |
      ForEach-Object { [pscustomobject]@{ Href = $_.Groups[1].Value; Bits = $_.Groups[2].Value } }
    $pick = ($links | Where-Object Bits -eq "64" | Select-Object -First 1)
    if (-not $pick) { $pick = $links | Select-Object -First 1 }
    if (-not $pick) {
      throw "Couldn't find a Windows download link on $page. Download the Windows zip yourself and run: .\get-zandronum.ps1 -Zip <path-to-zip>"
    }
    $Url = ([Uri]::new([Uri]$page, $pick.Href)).AbsoluteUri
  }
  $Zip = Join-Path $env:TEMP ([IO.Path]::GetFileName(([Uri]$Url).AbsolutePath))
  Write-Host "Downloading $Url"
  Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Zip
}
if (-not (Test-Path $Zip)) { throw "Zip not found: $Zip" }

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Expand-Archive -Force -Path $Zip -DestinationPath $Dest
$exe = Get-ChildItem -Path $Dest -Recurse -Filter "zandronum.exe" | Select-Object -First 1
if (-not $exe) { throw "zandronum.exe wasn't in $Zip. Is it the Windows build?" }
$zanDir = $exe.DirectoryName
Write-Host "Zandronum installed: $($exe.FullName)"

if (-not $NoPath) {
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (($userPath -split ";") -notcontains $zanDir) {
    [Environment]::SetEnvironmentVariable("Path", ($userPath.TrimEnd(";") + ";" + $zanDir).TrimStart(";"), "User")
    Write-Host "Added $zanDir to your PATH (restart ColeForge to pick it up)."
  }
}

if ($Firewall) {
  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $admin) { Write-Warning "-Firewall needs an elevated PowerShell; skipped. Windows will ask the first time you host instead." }
  else {
    foreach ($rule in @(@{ Name = "Zandronum game server"; Port = 10666 }, @{ Name = "Zandronum LAN browser"; Port = 15101 })) {
      if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol UDP -LocalPort $rule.Port -Action Allow -Profile Private | Out-Null
      }
    }
    Write-Host "Opened UDP 10666 (game) and 15101 (LAN browser) on private networks."
  }
}

$iwads = Get-ChildItem -Path $zanDir -Include "doom.wad", "doom2.wad", "freedoom1.wad", "freedoom2.wad", "plutonia.wad", "tnt.wad" -Recurse -ErrorAction SilentlyContinue
if (-not $iwads) {
  Write-Host ""
  Write-Host "Next: copy doom2.wad (from your copy of DOOM II) or the free freedoom2.wad (freedoom.github.io) into:"
  Write-Host "  $zanDir"
}
Write-Host "Done. In ColeForge: Forge Arcade -> Zandronum, or open Forge Game Browser."
