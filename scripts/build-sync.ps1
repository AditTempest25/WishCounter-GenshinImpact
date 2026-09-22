$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Project = Join-Path $Root "apps\sync\IrminsulSync.csproj"
$Output = Join-Path $Root "dist\sync"
$Exe = Join-Path $Output "IrminsulSync.exe"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw ".NET SDK 8+ is required to build Irminsul Sync. Install it from Microsoft, then rerun this script."
}

$Sdks = dotnet --list-sdks
if ($LASTEXITCODE -ne 0 -or -not ($Sdks | Select-String '^8\.')) {
    throw ".NET 8 SDK is required. Installed SDKs: $Sdks"
}

New-Item -ItemType Directory -Force -Path $Output | Out-Null

dotnet publish $Project `
    -c Release `
    -r win-x64 `
    --self-contained true `
    /p:PublishSingleFile=true `
    /p:IncludeNativeLibrariesForSelfExtract=true `
    -o $Output

if ($LASTEXITCODE -ne 0) {
    throw "Irminsul Sync build failed. Exit code: $LASTEXITCODE"
}
if (-not (Test-Path -LiteralPath $Exe -PathType Leaf)) {
    throw "Publish completed but IrminsulSync.exe was not found."
}
Write-Host "Built successfully: $Exe" -ForegroundColor Green
