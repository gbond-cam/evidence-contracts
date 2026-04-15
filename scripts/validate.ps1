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

    $exampleSchemaMap = @{
        'examples/ingestion-pull.example.json'               = 'schemas/ingestion-request.1.0.schema.json'
        'examples/ingestion-push-inline.example.json'        = 'schemas/ingestion-request.1.0.schema.json'
        'examples/ingestion-reference-sharepoint.example.json' = 'schemas/ingestion-request.1.0.schema.json'
        'examples/content-complete.example.json'             = 'schemas/ingestion-status.1.0.schema.json'
    }

    $allPassed = $true
    foreach ($entry in $exampleSchemaMap.GetEnumerator()) {
        $example = $entry.Key
        $schema  = $entry.Value

        # Extract the "value" node from the example file for validation
        $exampleObj = Get-Content $example -Raw | ConvertFrom-Json
        $valueJson  = $exampleObj.value | ConvertTo-Json -Depth 20

        $tmpFile = [System.IO.Path]::GetTempFileName() + '.json'
        $valueJson | Set-Content $tmpFile -Encoding utf8

        Write-Host "  Checking $example against $schema ... " -NoNewline
        & npx ajv validate -s $schema -d $tmpFile --spec=draft2020 2>&1 | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "PASS" -ForegroundColor Green
        } else {
            Write-Host "FAIL" -ForegroundColor Red
            & npx ajv validate -s $schema -d $tmpFile --spec=draft2020
            $allPassed = $false
        }

        Remove-Item $tmpFile -ErrorAction SilentlyContinue
    }

    if (-not $allPassed) {
        Write-Error "One or more example validations failed."
    }

    Write-Host "`n==> All checks passed." -ForegroundColor Green
}
finally {
    Pop-Location
}
