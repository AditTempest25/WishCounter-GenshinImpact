param(
    [string]$Target = "D:\Project\IrminsulWish",
    [switch]$InstallWebDependencies
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $PSScriptRoot
$TargetParent = Split-Path -Parent $Target

Write-Host "Irminsul Wish setup" -ForegroundColor Cyan
Write-Host "Source : $SourceRoot"
Write-Host "Target : $Target"

New-Item -ItemType Directory -Force -Path $TargetParent | Out-Null
New-Item -ItemType Directory -Force -Path $Target | Out-Null

# Copy repository files, excluding generated dependency folders.
$null = robocopy $SourceRoot $Target /E /XD node_modules .next vendor bin obj dist apps\api /XF .env .env.local
if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit code $LASTEXITCODE"
}

$ApiPath = Join-Path $Target "apps\api"
$OverlayPath = Join-Path $Target "apps\api-overlay"

if (Get-Command composer -ErrorAction SilentlyContinue) {
    if (-not (Test-Path (Join-Path $ApiPath "artisan"))) {
        Write-Host "Creating Laravel 13 API..." -ForegroundColor Cyan
        Push-Location (Join-Path $Target "apps")
        try {
            composer create-project laravel/laravel api "^13.0" --no-interaction
        }
        finally {
            Pop-Location
        }
    }

    Write-Host "Applying Irminsul API files..." -ForegroundColor Cyan
    $null = robocopy $OverlayPath $ApiPath /E
    if ($LASTEXITCODE -gt 7) {
        throw "Could not apply Laravel overlay. robocopy exit code $LASTEXITCODE"
    }

    $ApiEnv = Join-Path $ApiPath ".env"
    if (-not (Test-Path $ApiEnv)) {
        Copy-Item (Join-Path $ApiPath ".env.example") $ApiEnv
    }

    # Fastest local POC: SQLite. Production can move to PostgreSQL without changing models.
    $envText = Get-Content $ApiEnv -Raw
    $envText = $envText -replace '(?m)^DB_CONNECTION=.*$', 'DB_CONNECTION=sqlite'
    $envText = $envText -replace '(?m)^#?\s*DB_HOST=.*\r?\n?', ''
    $envText = $envText -replace '(?m)^#?\s*DB_PORT=.*\r?\n?', ''
    $envText = $envText -replace '(?m)^#?\s*DB_DATABASE=.*\r?\n?', ''
    $envText = $envText -replace '(?m)^#?\s*DB_USERNAME=.*\r?\n?', ''
    $envText = $envText -replace '(?m)^#?\s*DB_PASSWORD=.*\r?\n?', ''
    if ($envText -notmatch '(?m)^CORS_ALLOWED_ORIGINS=') {
        $envText += "`r`nCORS_ALLOWED_ORIGINS=http://localhost:3000`r`n"
    }
    Set-Content $ApiEnv $envText -Encoding UTF8

    $Sqlite = Join-Path $ApiPath "database\database.sqlite"
    if (-not (Test-Path $Sqlite)) { New-Item -ItemType File $Sqlite | Out-Null }

    Push-Location $ApiPath
    try {
        php artisan key:generate --force
        php artisan migrate --force
    }
    finally {
        Pop-Location
    }
} else {
    Write-Warning "Composer is not installed. Project files were copied, but apps\api was not scaffolded. Install Composer and rerun this script."
}

$WebPath = Join-Path $Target "apps\web"
$WebEnv = Join-Path $WebPath ".env.local"
if (-not (Test-Path $WebEnv)) {
    Copy-Item (Join-Path $WebPath ".env.example") $WebEnv
}

if ($InstallWebDependencies) {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        Push-Location $WebPath
        try { npm install }
        finally { Pop-Location }
    } else {
        Write-Warning "npm not found; skipped web dependencies."
    }
}

if ((Get-Command git -ErrorAction SilentlyContinue) -and -not (Test-Path (Join-Path $Target ".git"))) {
    Push-Location $Target
    try { git init | Out-Null }
    finally { Pop-Location }
}

Write-Host "" 
Write-Host "Project ready at $Target" -ForegroundColor Green
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. cd $Target\apps\web ; npm install ; npm run dev"
Write-Host "  2. cd $Target\apps\api ; php artisan serve"
Write-Host "  3. cd $Target ; .\scripts\build-sync.ps1"
Write-Host "  4. .\scripts\register-protocol.ps1"
Write-Host "" 
Write-Host "No Windows startup entry is created." -ForegroundColor Yellow
