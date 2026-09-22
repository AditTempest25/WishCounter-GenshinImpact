$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Api = Join-Path $Root "apps\api"
$Web = Join-Path $Root "apps\web"

if (-not (Test-Path (Join-Path $Api "artisan"))) {
    throw "Laravel API not found. Run .\scripts\setup-windows.ps1 first."
}
if (-not (Test-Path (Join-Path $Web "node_modules"))) {
    throw "Web dependencies not installed. Run npm install inside apps\web first."
}

Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$Api'; php artisan serve"
)

Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$Web'; npm run dev"
)

Write-Host "Started API and web development servers." -ForegroundColor Green
Write-Host "Web: http://localhost:3000"
Write-Host "API: http://localhost:8000"
