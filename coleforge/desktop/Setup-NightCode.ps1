<#
  NightCode setup for your own PC: everything in one NightCode folder on your desktop.

    Desktop\NightCode\
      NightCode.lnk     start NightCode (double-click)
      App\              the NightCode app (ColeForge.exe), installed from a fresh build
      Games\            Free Games (games, ScummVM, saves)
      source\           the NightCode source code it was built from (git)

  It installs Git and Node.js with winget if they're missing, clones (or updates) the repository,
  builds the Windows installer with electron-builder and installs it into Desktop\NightCode\App.
  Run it again any time to update. Your settings, documents and API keys stay where NightCode keeps
  them (its app data and %USERPROFILE%\.coleforge), not in the desktop folder.

  Usage (PowerShell, no admin needed):
    Set-ExecutionPolicy -Scope Process Bypass
    .\Setup-NightCode.ps1                                   # main branch
    .\Setup-NightCode.ps1 -Branch claude/serene-darwin-x8jr1x
    .\Setup-NightCode.ps1 -Folder D:\NightCode               # somewhere other than the desktop
#>
[CmdletBinding()]
param(
  [string]$Branch = "main",
  [string]$Folder = (Join-Path ([Environment]::GetFolderPath("Desktop")) "NightCode"),
  [string]$Repo = "https://github.com/NexusWebOS/SFXGenerator.git",
  [switch]$NoLaunch
)
$ErrorActionPreference = "Stop"

function Say([string]$text) { Write-Host ""; Write-Host ">> $text" -ForegroundColor Cyan }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") }
function Need([string]$cmd, [string]$wingetId) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { return }
  Say "Installing $wingetId"
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "$cmd is missing and winget isn't available. Install $wingetId by hand, then run this again." }
  & winget install -e --id $wingetId --silent --accept-package-agreements --accept-source-agreements | Out-Host
  Refresh-Path
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$wingetId installed, but $cmd isn't on PATH yet. Open a new PowerShell window and run this again." }
}
function Run([string]$exe, [string[]]$argv, [string]$where) {
  Push-Location $where
  try {
    & $exe @argv | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "$exe $($argv -join ' ') failed (exit $LASTEXITCODE)." }
  } finally { Pop-Location }
}

Write-Host "NightCode setup -> $Folder" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Folder, (Join-Path $Folder "Games") | Out-Null

Need "git" "Git.Git"
Need "node" "OpenJS.NodeJS.LTS"
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) { $npm = "npm" }

$src = Join-Path $Folder "source"
if (Test-Path (Join-Path $src ".git")) {
  Say "Updating the source ($Branch)"
  Run "git" @("fetch", "--depth", "1", "origin", $Branch) $src
  Run "git" @("checkout", "-B", $Branch, "FETCH_HEAD") $src
} else {
  Say "Downloading the source ($Branch)"
  Run "git" @("clone", "--depth", "1", "--branch", $Branch, $Repo, $src) $Folder
}

$desktop = Join-Path $src "coleforge\desktop"
Say "Building NightCode (a few minutes the first time)"
Run $npm @("install", "--no-audit", "--no-fund") $desktop
Run $npm @("run", "copy-app") $desktop
Run (Join-Path $desktop "node_modules\.bin\electron-builder.cmd") @("--win", "nsis", "--x64", "--publish", "never") $desktop

$installer = Get-ChildItem (Join-Path $desktop "dist") -Filter "ColeForge-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) { throw "The build finished but there's no installer in $desktop\dist." }

$app = Join-Path $Folder "App"
Say "Installing into $app"
Get-Process ColeForge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
# NSIS: /S silent, /currentuser no admin, /D= target folder (must come last, unquoted).
$p = Start-Process -FilePath $installer.FullName -ArgumentList "/S", "/currentuser", "/D=$app" -PassThru -Wait
$exe = Join-Path $app "ColeForge.exe"
for ($i = 0; $i -lt 30 -and -not (Test-Path $exe); $i++) { Start-Sleep -Seconds 1 }
if (-not (Test-Path $exe)) { throw "The installer finished (exit $($p.ExitCode)) but ColeForge.exe isn't in $app." }

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path $Folder "NightCode.lnk"))
$lnk.TargetPath = $exe; $lnk.WorkingDirectory = $app; $lnk.Description = "NightCode"; $lnk.IconLocation = "$exe,0"; $lnk.Save()

Write-Host ""
Write-Host "NightCode is installed in $Folder" -ForegroundColor Green
Write-Host "  Start it:   $Folder\NightCode.lnk (also in the Start menu as ColeForge)"
Write-Host "  Free Games: on the NightCode desktop; games go to $Folder\Games"
Write-Host "  Update:     run this script again"
if (-not $NoLaunch) { Start-Process -FilePath $exe -WorkingDirectory $app }
