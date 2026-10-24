$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $repoRoot 'games/chronicle-source'
$gameDist = Join-Path $source 'dist'
$publicGame = Join-Path $repoRoot 'public/games/chronicle'
$expectedPublicGame = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'public/games/chronicle'))
$actualPublicGame = [System.IO.Path]::GetFullPath($publicGame)
if ($actualPublicGame -ne $expectedPublicGame -or -not $actualPublicGame.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to sync to an unexpected path: $actualPublicGame"
}

$branch = (& git -C $repoRoot branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw "Deployment requires the main branch; current branch is '$branch'." }
$stagedBefore = @(& git -C $repoRoot diff --cached --name-only)
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the Git index.' }
if ($stagedBefore.Count -gt 0) { throw 'The Git index already contains staged changes. Commit or unstage them before this deployment.' }

Push-Location $source
try {
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "Game build failed with exit code $LASTEXITCODE." }
} finally { Pop-Location }

if (-not (Test-Path -LiteralPath $gameDist -PathType Container)) { throw 'The game build did not create dist/.' }
New-Item -ItemType Directory -Path $publicGame -Force | Out-Null
& robocopy $gameDist $publicGame /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw "Copying the game build failed with robocopy exit code $LASTEXITCODE." }

Push-Location $repoRoot
try {
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw "Site build failed with exit code $LASTEXITCODE." }
} finally { Pop-Location }

& git -C $repoRoot diff --check
if ($LASTEXITCODE -ne 0) { throw 'Git whitespace validation failed.' }
& git -C $repoRoot add -- games/chronicle-source/src games/chronicle-source/public/assets games/chronicle-source/tools/convert.py games/chronicle-source/ASSET-CREDITS.md games/chronicle-source/SECURITY.md public/games/chronicle scripts/deploy-chronicle.ps1
if ($LASTEXITCODE -ne 0) { throw 'Could not stage the game source and generated assets.' }
& git -C $repoRoot diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Staged changes failed whitespace validation.' }
& git -C $repoRoot commit -m 'Integrate CC0 assets, spatial audio, and map workshop'
if ($LASTEXITCODE -ne 0) { throw 'Git commit failed.' }
& git -C $repoRoot push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push to origin/main failed.' }
