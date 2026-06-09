# GeoTrails - rebuild and redeploy the backend container.
# Run from the project root:  .\deploy.ps1
# Options:
#   -Full      Rebuild every service (backend + frontend + postgres image)
#   -NoCache   Pass --no-cache to docker compose build

param(
    [switch]$Full,
    [switch]$NoCache
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# BuildKit is required for --mount=type=cache in the Dockerfile
$env:DOCKER_BUILDKIT = "1"
$env:COMPOSE_DOCKER_CLI_BUILD = "1"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host ""
Write-Host "=== GeoTrails Deploy ===" -ForegroundColor Cyan
Write-Host "Root : $Root"
Write-Host "Mode : $(if ($Full) { 'full stack' } else { 'backend only' })"
Write-Host ""

# 1. Build
$buildArgs = @("compose", "build")
if ($NoCache) { $buildArgs += "--no-cache" }

if ($Full) {
    $buildArgs += "backend", "frontend", "postgres"
    Write-Host "[1/3] Building backend, frontend and postgres images..." -ForegroundColor Yellow
} else {
    $buildArgs += "backend"
    Write-Host "[1/2] Building backend image..." -ForegroundColor Yellow
}

docker @buildArgs
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose build failed (exit $LASTEXITCODE)"; exit 1 }

# 2. Recreate changed containers
if ($Full) {
    Write-Host "[2/3] Starting full stack..." -ForegroundColor Yellow
    docker compose up -d --force-recreate backend frontend postgres redis prometheus grafana
} else {
    Write-Host "[2/2] Recreating backend container..." -ForegroundColor Yellow
    docker compose up -d --force-recreate --no-deps backend
}
if ($LASTEXITCODE -ne 0) { Write-Error "docker compose up failed (exit $LASTEXITCODE)"; exit 1 }

# 3. Wait for backend to start (90s timeout)
Write-Host ""
Write-Host "Waiting for backend to become healthy..." -ForegroundColor Yellow

$deadline = (Get-Date).AddSeconds(90)
$ready = $false

while ((Get-Date) -lt $deadline) {
    $logs = docker compose logs --tail=20 backend 2>&1
    if ($logs -match "Started GeotrailApplication") {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 3
}

Write-Host ""
if ($ready) {
    Write-Host "Backend is up." -ForegroundColor Green
} else {
    Write-Host "Backend did not report ready within 90 s - check logs:" -ForegroundColor Yellow
    Write-Host "  docker compose logs -f backend"
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "  Backend : http://localhost:8080/api"
Write-Host "  Swagger : http://localhost:8080/api/swagger-ui.html"
Write-Host "  Grafana : http://localhost:3000"
Write-Host ""
