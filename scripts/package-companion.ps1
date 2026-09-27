param([string]$ApiBase = 'http://localhost:8000/api')
$ErrorActionPreference = 'Stop'
$ApiUri = [uri]$ApiBase
if (-not $ApiUri.IsAbsoluteUri -or ($ApiUri.Scheme -ne 'https' -and -not ($ApiUri.Scheme -eq 'http' -and $ApiUri.IsLoopback)) -or $ApiUri.UserInfo -or $ApiUri.Query -or $ApiUri.Fragment) { throw 'API must use HTTPS or local development HTTP.' }
$Root = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'build-sync.ps1')
$Package = Join-Path $Root 'dist\companion-installer'
New-Item -ItemType Directory -Force -Path $Package | Out-Null
Copy-Item -LiteralPath (Join-Path $Root 'dist\sync\IrminsulSync.exe') -Destination $Package -Force
foreach ($Script in @('install-companion.ps1', 'register-protocol.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $Script) -Destination $Package -Force
}
@'
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-companion.ps1"
pause
'@ | Set-Content -LiteralPath (Join-Path $Package 'Install.cmd') -Encoding Ascii
@{ apiBase = $ApiBase.TrimEnd('/') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Package 'irminsul-config.json') -Encoding utf8NoBOM
$Zip = Join-Path $Root 'dist\IrminsulSync-Windows.zip'
Compress-Archive -LiteralPath (Join-Path $Package 'IrminsulSync.exe'), (Join-Path $Package 'install-companion.ps1'), (Join-Path $Package 'register-protocol.ps1'), (Join-Path $Package 'Install.cmd'), (Join-Path $Package 'irminsul-config.json') -DestinationPath $Zip -Force
Write-Host "Ready to distribute: $Zip" -ForegroundColor Green
$DownloadDirectory = Join-Path $Root 'apps\web\public\downloads'
New-Item -ItemType Directory -Force -Path $DownloadDirectory | Out-Null
Copy-Item -LiteralPath $Zip -Destination (Join-Path $DownloadDirectory 'IrminsulSync-Windows.zip') -Force
