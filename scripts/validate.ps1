<#
.SYNOPSIS
    Validate the Evidence Ingestion API contract (OpenAPI + JSON Schemas + examples).
.DESCRIPTION
    Runs Spectral linting on the OpenAPI specification and validates each example
    file against its corresponding JSON Schema using ajv-cli.
    Requires Node.js >= 18 and npm packages installed (npm install).
.EXAMPLE
    .\scripts\validate.ps1
.EXAMPLE
    .\scripts\validate.ps1 -Strict
    Treats warnings as errors.
#>
[CmdletBinding()]
param(
    [switch]$Strict
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path $PSScriptRoot -Parent
Push-Location $Root

try {
    # ── 1. Spectral lint ──────────────────────────────────────────────────
    Write-Host "`n==> Spectral lint: openapi/evidence-ingestion.v1.yaml" -ForegroundColor Cyan
    $spectralArgs = @(
        'lint',
        'openapi/evidence-ingestion.v1.yaml',
        '--ruleset', 'tools/spectral.yaml',
        '--format', 'pretty'
    )
    if ($Strict) { $spectralArgs += '--fail-severity', 'warn' }

    & npx spectral @spectralArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Spectral lint failed (exit $LASTEXITCODE)."
    }

    # ── 2. JSON Schema example validation ─────────────────────────────────
    Write-Host "`n==> Validating examples against schemas" -ForegroundColor Cyan

    & node scripts-js/validate-examples.js
    if ($LASTEXITCODE -ne 0) {
        Write-Error "One or more example validations failed (exit $LASTEXITCODE)."
    }

    Write-Host "`n==> All checks passed." -ForegroundColor Green
}
finally {
    Pop-Location
}
