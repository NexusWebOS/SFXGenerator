<#
  Windows – ColeForge Edition: build the NightCode programs (Netcon, Disk Dude) as standalone .exe files.

  ColeForge can already run them from their Python source (needs Python 3.10+ and Pillow). Building
  the .exe versions means they start without Python installed. The executables go to
  %LOCALAPPDATA%\ColeForge\programs, where ColeForge looks first.

  Usage (PowerShell):
    Set-ExecutionPolicy -Scope Process Bypass
    .\build-nightcode-programs.ps1
#>
[CmdletBinding()]
param(
  [string]$Source = (Join-Path $PSScriptRoot "..\..\programs\retro-tools"),
  [string]$Dest = (Join-Path $env:LOCALAPPDATA "ColeForge\programs")
)
$ErrorActionPreference = "Stop"
$Source = (Resolve-Path $Source).Path
if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw "The Python launcher (py) wasn't found. Install Python 3.10+ from python.org (tick 'py launcher'), then run this again."
}

Write-Host "Installing build requirements (Pillow, PyInstaller) for this user..."
py -3 -m pip install --user --upgrade -r (Join-Path $Source "requirements.txt") pyinstaller | Out-Host

# The upstream build script (from NexusWebOS/NightCode) does the PyInstaller work.
& (Join-Path $Source "Build-Retro-Tools.ps1")

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
foreach ($exe in @("Netcon.exe", "DiskDude.exe")) {
  $built = Join-Path $Source "dist\$exe"
  if (-not (Test-Path $built)) { throw "$exe wasn't built; check the PyInstaller output above." }
  Copy-Item -Force $built $Dest
}
Write-Host "Done: Netcon.exe and DiskDude.exe are in $Dest. ColeForge will launch them from the desktop icons."
