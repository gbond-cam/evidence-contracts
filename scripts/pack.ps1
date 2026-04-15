<#
.SYNOPSIS
    Pack the Evidence Contracts package for distribution.
.DESCRIPTION
    Copies the public contract artefacts (openapi/, schemas/, examples/, docs/)
    into a versioned zip archive suitable for attaching to a GitHub Release or
    uploading to a package feed.
.EXAMPLE
    .\scripts\pack.ps1
    Produces: dist/consilium-evidence-contracts-1.0.0.zip
.EXAMPLE
    .\scripts\pack.ps1 -Version "1.1.0"
    Overrides the version read from package.json.
#>
[CmdletBinding()]
param(
    [string]$Version
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root    = Split-Path $PSScriptRoot -Parent
$DistDir = Join-Path $Root 'dist'

Push-Location $Root
try {
    # Resolve version
    if (-not $Version) {
        $pkg     = Get-Content 'package.json' -Raw | ConvertFrom-Json
        $Version = $pkg.version
    }

    Write-Host "==> Packing @consilium/evidence-contracts v$Version" -ForegroundColor Cyan

    # Clean / create dist/
    if (Test-Path $DistDir) {
        Remove-Item $DistDir -Recurse -Force
    }
    New-Item $DistDir -ItemType Directory | Out-Null

    $StagingDir = Join-Path $DistDir "consilium-evidence-contracts-$Version"
    New-Item $StagingDir -ItemType Directory | Out-Null

    # Artefacts to include
    $includes = @('openapi', 'schemas', 'examples', 'docs', 'package.json')
    foreach ($item in $includes) {
        $src = Join-Path $Root $item
        $dst = Join-Path $StagingDir $item
        if (Test-Path $src -PathType Container) {
            Copy-Item $src $dst -Recurse
        } elseif (Test-Path $src -PathType Leaf) {
            Copy-Item $src $dst
        } else {
            Write-Warning "Artefact not found, skipping: $item"
        }
    }

    # Create zip
    $ZipPath = Join-Path $DistDir "consilium-evidence-contracts-$Version.zip"
    Compress-Archive -Path "$StagingDir\*" -DestinationPath $ZipPath -Force

    # Clean staging dir
    Remove-Item $StagingDir -Recurse -Force

    $size = (Get-Item $ZipPath).Length
    Write-Host "==> Created: $ZipPath ($([math]::Round($size / 1KB, 1)) KB)" -ForegroundColor Green
}
finally {
    Pop-Location
}
