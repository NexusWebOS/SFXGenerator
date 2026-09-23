<#
  Restore Explorer as the shell and the Windows default sound scheme for the current user.
  Usage:  Set-ExecutionPolicy -Scope Process Bypass; .\uninstall-coleforge.ps1
#>
$ErrorActionPreference = "Stop"
$winlogon = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Winlogon"
$backupKey = "HKCU:\Software\ColeForge"

$previous = (Get-ItemProperty -Path $backupKey -Name PreviousShell -ErrorAction SilentlyContinue).PreviousShell
if ($previous) { Set-ItemProperty -Path $winlogon -Name Shell -Value $previous }
else { Remove-ItemProperty -Path $winlogon -Name Shell -ErrorAction SilentlyContinue } # machine default (explorer.exe) applies
Remove-ItemProperty -Path $backupKey -Name PreviousShell -ErrorAction SilentlyContinue
Write-Host "Shell restored to Explorer. Sign out and back in to apply."

# Point every event's .Current back at the Windows default scheme.
Get-ChildItem "HKCU:\AppEvents\Schemes\Apps" -Recurse | Where-Object { $_.PSChildName -eq ".Current" } | ForEach-Object {
  $default = Join-Path ($_.PSParentPath) ".Default"
  $value = (Get-ItemProperty -Path $default -ErrorAction SilentlyContinue).'(default)'
  Set-ItemProperty -Path $_.PSPath -Name "(default)" -Value ($(if ($value) { $value } else { "" }))
}
Set-ItemProperty -Path "HKCU:\AppEvents\Schemes" -Name "(default)" -Value ".Default"
Write-Host "Sound scheme restored to Windows Default. (ColeForge Classic stays available in Sound settings.)"
