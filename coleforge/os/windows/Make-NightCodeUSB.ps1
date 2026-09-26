<#
  NightCode OS: make the install USB for the spare laptop.

  Turns the official Windows 11 ISO into a USB stick that installs Windows 11 almost hands-free and comes
  up in NightCode: by default NightCode starts full screen at every sign-in as an app, with Windows' own
  desktop (taskbar, Wi-Fi, Settings) intact underneath; -ShellMode makes it replace explorer.exe instead. Run it on your main PC, in an elevated PowerShell:

    Set-ExecutionPolicy -Scope Process Bypass
    .\Make-NightCodeUSB.ps1                                   # finds the ISO, asks which USB stick to erase
    .\Make-NightCodeUSB.ps1 -Iso D:\Win11_25H2_English_x64.iso -DiskNumber 3
    .\Make-NightCodeUSB.ps1 -ExistingUsb E:\                  # add NightCode to a Windows USB made with Rufus

  Options:
    -UserName Cole          the laptop's account (you're asked for its password)
    -ComputerName NIGHTCODE
    -AutoLogon              keep signing in by itself after setup (a spare laptop at home); off by default
    -ShellMode              make NightCode the Windows shell (no Explorer, taskbar or Windows Wi-Fi menu)
    -NoPython               don't install Python / build Netcon and Disk Dude on first boot
    -Games                  also fetch the Forge Arcade game engines on first boot
    -SkipHardwareCheck      let Setup install on a laptop without TPM 2.0 / Secure Boot / a supported CPU
    -Installer <path>       the ColeForge installer (ColeForge-<version>-x64.exe); found automatically when
                            it sits in NightCode\installers (the kit from GitHub Actions) or coleforge\desktop\dist

  What's on the stick: the Windows 11 files (install.wim split to fit FAT32, which every UEFI laptop boots),
  autounattend.xml (the answers for Setup) and sources\$OEM$\$1\NightCode (copied to C:\NightCode by Setup).
  The stick holds your password in autounattend.xml until you erase or remake it; the laptop's copy is
  deleted on first boot.
#>
[CmdletBinding(DefaultParameterSetName = "New")]
param(
  [Parameter(ParameterSetName = "New")][string]$Iso = "",
  [Parameter(ParameterSetName = "New")][int]$DiskNumber = -1,
  [Parameter(ParameterSetName = "New")][switch]$AllowNonUsb,
  [Parameter(ParameterSetName = "Existing", Mandatory = $true)][string]$ExistingUsb,
  [string]$UserName = "Cole",
  [System.Security.SecureString]$Password,
  [string]$ComputerName = "NIGHTCODE",
  [string]$Installer = "",
  [switch]$AutoLogon,
  [switch]$ShellMode,
  [switch]$NoPython,
  [switch]$Games,
  [switch]$SkipHardwareCheck,
  [switch]$Yes
)
$ErrorActionPreference = "Stop"
$Here = $PSScriptRoot
$Repo = Join-Path $Here "..\.."                     # coleforge\ when run from the repository

function Say([string]$m, [string]$c = "Cyan") { Write-Host $m -ForegroundColor $c }
function First-Existing([string[]]$paths) { foreach ($p in $paths) { if ($p -and (Test-Path $p)) { return (Resolve-Path $p).Path } } return $null }

# ---------------------------------------------------------------- checks
if ($PSCmdlet.ParameterSetName -eq "New") {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) { throw "Run this in an elevated PowerShell (right-click PowerShell > Run as administrator): it erases and writes a USB drive." }
}
if ($UserName -notmatch '^[A-Za-z0-9][A-Za-z0-9 ._-]{0,19}$') { throw "User name: 1-20 letters, digits, spaces, dots, dashes or underscores." }
if ($ComputerName -notmatch '^[A-Za-z0-9][A-Za-z0-9-]{0,14}$') { throw "Computer name: 1-15 letters, digits or dashes." }

# ---------------------------------------------------------------- what goes on the stick
$payloadSrc = Join-Path $Here "NightCode"
if (-not (Test-Path (Join-Path $payloadSrc "firstboot.ps1"))) { throw "NightCode\firstboot.ps1 is missing next to this script." }
$coreWindows = First-Existing @((Join-Path $payloadSrc "coleforge\core\windows"), (Join-Path $Repo "core\windows"))
if (-not $coreWindows -or -not (Test-Path (Join-Path $coreWindows "install-coleforge.ps1"))) { throw "Can't find core\windows\install-coleforge.ps1 (run this from the repository or the NightCode OS kit)." }
$wallpaper = First-Existing @((Join-Path $payloadSrc "art\nightcode.png"), (Join-Path $Repo "shell\assets\art\wallpapers\nightcode.png"))
if (-not $Installer) {
  $found = @()
  foreach ($dir in @((Join-Path $payloadSrc "installers"), (Join-Path $Repo "desktop\dist"))) {
    if (Test-Path $dir) { $found += Get-ChildItem $dir -Filter "ColeForge-*.exe" -ErrorAction SilentlyContinue }
  }
  $pick = $found | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($pick) { $Installer = $pick.FullName }
}
if (-not $Installer -or -not (Test-Path $Installer)) {
  throw @"
No ColeForge installer found. Either:
  - download the "NightCode-OS-Kit" from the repository's GitHub Actions (it includes the installer) and run this script from it, or
  - build it: cd coleforge\desktop; npm install; npm run dist:win   (then run this again), or
  - pass -Installer C:\path\to\ColeForge-1.0.0-x64.exe
"@
}

if (-not $Password) {
  $Password = Read-Host "Password for the laptop account '$UserName' (you can change it later in Windows)" -AsSecureString
}
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

function Write-Payload([string]$usbRoot) {
  $dest = Join-Path $usbRoot 'sources\$OEM$\$1\NightCode'
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item -Recurse -Force (Join-Path $payloadSrc "*") $dest
  $cw = Join-Path $dest "coleforge\core\windows"
  New-Item -ItemType Directory -Force -Path $cw | Out-Null
  if ((Resolve-Path $coreWindows).Path -ne (Resolve-Path $cw).Path) { Copy-Item -Force (Join-Path $coreWindows "*.ps1") $cw }
  New-Item -ItemType Directory -Force -Path (Join-Path $dest "art"), (Join-Path $dest "installers") | Out-Null
  if ($wallpaper) { Copy-Item -Force $wallpaper (Join-Path $dest "art\nightcode.png") }
  if ((Split-Path $Installer) -ne (Join-Path $dest "installers")) { Copy-Item -Force $Installer (Join-Path $dest "installers") }
  $cfg = [ordered]@{ autoLogon = [bool]$AutoLogon; python = (-not $NoPython); games = [bool]$Games; scheme = "NightCode"; mode = $(if ($ShellMode) { "shell" } else { "app" }); made = (Get-Date -Format s) }
  $cfg | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $dest "nightcode.json")

  # The answer file, from the template.
  $x = Get-Content -Raw -Encoding UTF8 (Join-Path $Here "autounattend.template.xml")
  $esc = { param($v) [Security.SecurityElement]::Escape([string]$v) }
  $culture = (Get-Culture).Name
  if (-not $culture) { $culture = "en-US" }
  $keyboard = "0409:00000409"
  try { $tip = (Get-WinUserLanguageList)[0].InputMethodTips[0]; if ($tip) { $keyboard = $tip } } catch { }
  $bypass = ""
  if ($SkipHardwareCheck) {
    $cmds = @("BypassTPMCheck", "BypassSecureBootCheck", "BypassRAMCheck", "BypassCPUCheck") | ForEach-Object -Begin { $i = 0 } -Process {
      $i++
      "<RunSynchronousCommand wcm:action=`"add`"><Order>$i</Order><Path>reg add HKLM\SYSTEM\Setup\LabConfig /v $_ /t REG_DWORD /d 1 /f</Path></RunSynchronousCommand>"
    }
    $bypass = "<RunSynchronous>" + ($cmds -join "") + "</RunSynchronous>"
  }
  $x = $x.Replace("<!--{{HARDWARE_CHECK_BYPASS}}-->", $bypass)
  $values = @{
    "{{COMPUTER_NAME}}" = $ComputerName; "{{USER_NAME}}" = $UserName; "{{PASSWORD}}" = $plain; "{{TIME_ZONE}}" = [TimeZoneInfo]::Local.Id
    "{{LOCALE}}" = $culture; "{{KEYBOARD}}" = $keyboard; "{{AUTOLOGON_COUNT}}" = $(if ($AutoLogon) { "9999999" } else { "1" })
  }
  foreach ($k in $values.Keys) { $x = $x.Replace($k, (& $esc $values[$k])) }
  [xml]$check = $x                                      # refuse to write a broken answer file
  [IO.File]::WriteAllText((Join-Path $usbRoot "autounattend.xml"), $x, (New-Object System.Text.UTF8Encoding $false))
  Say "  NightCode files and autounattend.xml written to $usbRoot" "Green"
}

# ---------------------------------------------------------------- mode 2: add to an existing Windows USB
if ($PSCmdlet.ParameterSetName -eq "Existing") {
  if (-not (Test-Path $ExistingUsb)) { New-Item -ItemType Directory -Force -Path $ExistingUsb | Out-Null }
  if (-not (Test-Path (Join-Path $ExistingUsb "sources"))) { Say "  (no sources\ folder there: this doesn't look like a Windows install USB, writing the NightCode files anyway)" "Yellow" }
  Write-Payload $ExistingUsb
  Say "Done. Boot the laptop from that USB." "Cyan"
  return
}

# ---------------------------------------------------------------- mode 1: make the USB from the ISO
if (-not $Iso) {
  $roots = @((Join-Path $env:USERPROFILE "Downloads"), (Join-Path $env:USERPROFILE "Desktop"), $env:USERPROFILE)
  $cands = @()
  foreach ($r in $roots) {
    if (Test-Path $r) { $cands += Get-ChildItem $r -Recurse -Depth 3 -Filter "*.iso" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'win.?11|windows.?11' -and $_.Length -gt 3GB } }
  }
  $Iso = ($cands | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
  if (-not $Iso) { throw "Couldn't find a Windows 11 ISO in Downloads/Desktop. Pass -Iso C:\path\to\Win11.iso (get it from microsoft.com/software-download/windows11)." }
}
if (-not (Test-Path $Iso)) { throw "ISO not found: $Iso" }
Say "Windows 11 ISO: $Iso ($([math]::Round((Get-Item $Iso).Length / 1GB, 2)) GB)"

$usbDisks = @(Get-Disk | Where-Object { $_.BusType -eq "USB" -or ($AllowNonUsb -and -not $_.IsBoot -and -not $_.IsSystem) })
if ($DiskNumber -lt 0) {
  if (-not $usbDisks.Count) { throw "No USB drives found. Plug in a USB stick (16 GB or bigger)." }
  Say "USB drives:"
  $usbDisks | ForEach-Object { Write-Host ("  [{0}] {1}  {2:N1} GB" -f $_.Number, $_.FriendlyName, ($_.Size / 1GB)) }
  $DiskNumber = [int](Read-Host "Number of the USB drive to ERASE and turn into the NightCode installer")
}
$disk = Get-Disk -Number $DiskNumber
if ($disk.IsBoot -or $disk.IsSystem) { throw "Disk $DiskNumber is this PC's system disk. Not touching it." }
if ($disk.BusType -ne "USB" -and -not $AllowNonUsb) { throw "Disk $DiskNumber isn't a USB drive ($($disk.BusType)). Use -AllowNonUsb if you really mean it." }
if ($disk.Size -lt 14GB) { throw "Disk $DiskNumber is too small ($([math]::Round($disk.Size / 1GB, 1)) GB); use 16 GB or bigger." }
Say ("About to ERASE disk {0}: {1}, {2:N1} GB. Everything on it will be lost." -f $disk.Number, $disk.FriendlyName, ($disk.Size / 1GB)) "Yellow"
if (-not $Yes) {
  if ((Read-Host "Type ERASE to continue") -ne "ERASE") { Say "Cancelled." "Yellow"; return }
}

Say "Preparing the USB drive (GPT, FAT32: boots on every UEFI laptop)..."
if ($disk.PartitionStyle -ne "RAW") { Clear-Disk -Number $DiskNumber -RemoveData -RemoveOEM -Confirm:$false }
$disk = Get-Disk -Number $DiskNumber
if ($disk.PartitionStyle -eq "RAW") { Initialize-Disk -Number $DiskNumber -PartitionStyle GPT }
elseif ($disk.PartitionStyle -ne "GPT") { Set-Disk -Number $DiskNumber -PartitionStyle GPT }
$size = [math]::Min((Get-Disk -Number $DiskNumber).LargestFreeExtent, 31GB)      # Windows formats FAT32 up to 32 GB
$part = New-Partition -DiskNumber $DiskNumber -Size $size -AssignDriveLetter -GptType "{ebd0a0a2-b9e5-4433-87c0-68b6b72699c7}"
Format-Volume -Partition $part -FileSystem FAT32 -NewFileSystemLabel "NIGHTCODE" -Confirm:$false -Force | Out-Null
$letter = (Get-Partition -DiskNumber $DiskNumber -PartitionNumber $part.PartitionNumber).DriveLetter
if (-not $letter) { throw "The USB partition didn't get a drive letter." }
$usb = "$($letter):\"
Say "  USB ready at $usb" "Green"

Say "Copying Windows 11 from the ISO (10-20 minutes on USB 3)..."
$img = Mount-DiskImage -ImagePath $Iso -PassThru
try {
  $isoRoot = "$(($img | Get-Volume).DriveLetter):\"
  & robocopy.exe $isoRoot $usb /E /XF install.wim /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Host
  if ($LASTEXITCODE -ge 8) { throw "Copying the Windows files failed (robocopy exit $LASTEXITCODE)." }
  $wim = Join-Path $isoRoot "sources\install.wim"
  if (Test-Path $wim) {
    if ((Get-Item $wim).Length -ge 4GB) {
      Say "  splitting install.wim into FAT32-sized pieces (install.swm)..."
      & dism.exe /Split-Image /ImageFile:"$wim" /SWMFile:"$($usb)sources\install.swm" /FileSize:3800 | Out-Host
      if ($LASTEXITCODE -ne 0) { throw "DISM couldn't split install.wim (exit $LASTEXITCODE)." }
    } else {
      Copy-Item -Force $wim (Join-Path $usb "sources")
    }
  }
} finally {
  Dismount-DiskImage -ImagePath $Iso | Out-Null
}

Say "Adding NightCode..."
Write-Payload $usb

Say ""
Say "NightCode OS installer USB is ready ($usb)." "Green"
Say "Next, on the spare laptop:" "White"
Say "  1. Plug the USB in, power on and open the boot menu (F12 / F9 / F11 / Esc, depending on the maker); pick the USB (UEFI)." "White"
Say "  2. Windows Setup asks one thing: where to install. Pick the laptop's drive (delete its old partitions for a clean install)." "White"
Say "  3. Connect to Wi-Fi when asked. Everything else is automatic: it signs in, installs NightCode and restarts into it." "White"
