$ErrorActionPreference = 'Stop'
# The release ZIP places this script beside the published executable.
$Source = Join-Path $PSScriptRoot 'IrminsulSync.exe'
if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw 'Extract the entire companion ZIP before running Install.cmd.' }
$Destination = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'IrminsulWish\Companion'
$Target = Join-Path $Destination 'IrminsulSync.exe'
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
Copy-Item -LiteralPath $Source -Destination $Target -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'irminsul-config.json') -Destination (Join-Path $Destination 'irminsul-config.json') -Force
& (Join-Path $PSScriptRoot 'register-protocol.ps1') -ExecutablePath $Target
Write-Host 'Installed for your Windows account. Refresh the dashboard and start a new sync.' -ForegroundColor Green
Write-Host 'No administrator access or startup service is required.'
