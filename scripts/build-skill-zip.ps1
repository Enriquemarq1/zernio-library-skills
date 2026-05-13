# scripts/build-skill-zip.ps1
#
# Builds dist/zernio-publish.skill.zip with SKILL.md at the ZIP root and
# all paths using forward-slash separators (required by the ZIP spec —
# Windows backslashes break claude.ai's Upload Skill validator).
#
# Uses the .NET ZipFile API directly because PowerShell's built-in
# Compress-Archive writes backslashes on Windows.
#
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File scripts/build-skill-zip.ps1

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repoRoot = Split-Path -Parent $PSScriptRoot
$src      = Join-Path $repoRoot '.claude\skills\zernio-publish'
$dist     = Join-Path $repoRoot 'dist'
$out      = Join-Path $dist 'zernio-publish.skill.zip'

if (-not (Test-Path (Join-Path $src 'SKILL.md'))) {
    throw "Source SKILL.md not found at $src. Run this from the repo root."
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null
if (Test-Path $out) { Remove-Item $out -Force }

$srcFull = (Resolve-Path $src).Path
$srcLen  = $srcFull.Length + 1  # +1 for trailing separator
$skipNames = @('.DS_Store', 'Thumbs.db', 'desktop.ini')

$zipStream = [System.IO.File]::Open($out, [System.IO.FileMode]::Create)
$zipArchive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
        if ($skipNames -contains $_.Name) { return }

        # Relative path with forward-slash separators (ZIP spec)
        $rel = $_.FullName.Substring($srcLen).Replace('\', '/')

        $entry = $zipArchive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        try {
            $fileStream = [System.IO.File]::OpenRead($_.FullName)
            try {
                $fileStream.CopyTo($entryStream)
            } finally {
                $fileStream.Dispose()
            }
        } finally {
            $entryStream.Dispose()
        }
    }
} finally {
    $zipArchive.Dispose()
    $zipStream.Dispose()
}

$size = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "Built $out ($size KB)"

# Sanity check — verify no backslashes in stored paths
$archive = [System.IO.Compression.ZipFile]::OpenRead($out)
try {
    $badEntries = $archive.Entries | Where-Object { $_.FullName -match '\\' }
    if ($badEntries) {
        throw "Found backslash separators in: $($badEntries.FullName -join ', ')"
    }
    Write-Host "OK: $($archive.Entries.Count) entries, all use forward-slash separators."
} finally {
    $archive.Dispose()
}
