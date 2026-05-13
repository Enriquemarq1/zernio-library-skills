# scripts/build-skill-zip.ps1
#
# Builds dist/zernio-publish.skill.zip with SKILL.md at the ZIP root.
# This is the shape that claude.ai's Upload Skill UI accepts.
#
# Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/build-skill-zip.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$src      = Join-Path $repoRoot '.claude\skills\zernio-publish'
$dist     = Join-Path $repoRoot 'dist'
$out      = Join-Path $dist 'zernio-publish.skill.zip'
$staging  = Join-Path $env:TEMP "zernio-publish-build-$(Get-Random)"

if (-not (Test-Path (Join-Path $src 'SKILL.md'))) {
    throw "Source SKILL.md not found at $src. Run this from the repo root."
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null
New-Item -ItemType Directory -Force -Path $staging | Out-Null

try {
    Copy-Item -Path (Join-Path $src '*') -Destination $staging -Recurse -Force

    if (Test-Path $out) { Remove-Item $out -Force }

    Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $out -CompressionLevel Optimal

    $size = [math]::Round((Get-Item $out).Length / 1KB, 1)
    Write-Host "Built $out ($size KB)"
} finally {
    Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
}
