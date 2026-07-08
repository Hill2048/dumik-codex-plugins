param(
  [switch]$CheckOnly,
  [ValidateSet("Install", "Update")]
  [string]$Mode = "Install",
  [ValidateSet("Auto", "CEP", "UXP")]
  [string]$Flavor = "Auto",
  [switch]$Update
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginRoot = Split-Path -Parent $ScriptDir
$PluginName = "psb-smart-object-tools"
$TargetRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$Target = Join-Path $TargetRoot $PluginName
$BackupPattern = "psb-smart-object-tools.bak-*"
$UxpPackageRoot = Join-Path $PluginRoot "dist"
$RequiredFiles = @(
  "index.html",
  "js\main.js",
  "CSXS\manifest.xml",
  "jsx\link-smart-objects.jsx",
  "jsx\relink-missing-smart-objects.jsx",
  "jsx\collect-linked-smart-objects.jsx",
  "jsx\embed-linked-smart-objects.jsx",
  "jsx\clean-ps-metadata.jsx",
  "jsx\cleanup-unused-links.jsx",
  "jsx\stamp-usm-sharpen-documents.jsx"
)
$KeyFiles = @(
  "index.html",
  "js\main.js",
  "CSXS\manifest.xml",
  "jsx\link-smart-objects.jsx",
  "jsx\relink-missing-smart-objects.jsx",
  "jsx\collect-linked-smart-objects.jsx"
)

if ($Update) {
  $Mode = "Update"
}

function Test-PsbCepSource {
  param([string]$Path)

  if (!(Test-Path -LiteralPath $Path -PathType Container)) {
    return $false
  }
  foreach ($file in @("index.html", "js\main.js", "CSXS\manifest.xml", "jsx\link-smart-objects.jsx")) {
    if (!(Test-Path -LiteralPath (Join-Path $Path $file) -PathType Leaf)) {
      return $false
    }
  }
  return $true
}

function Test-PsbUxpSource {
  param([string]$Path)

  if (!(Test-Path -LiteralPath $Path -PathType Container)) {
    return $false
  }
  foreach ($file in @("manifest.json", "index.html", "js\main.js")) {
    if (!(Test-Path -LiteralPath (Join-Path $Path $file) -PathType Leaf)) {
      return $false
    }
  }
  return $true
}

function Find-PsbCepSource {
  $candidates = @()
  $candidates += Join-Path $PluginRoot "assets\psb-smart-object-tools\cep"
  $candidates += Join-Path $PluginRoot "assets\psb-smart-object-tools"

  try {
    $cwd = (Get-Location).Path
    if ($cwd) {
      $candidates += Join-Path $cwd "plugins\dumik-team-plugin\assets\psb-smart-object-tools\cep"
      $candidates += Join-Path $cwd "assets\psb-smart-object-tools\cep"
    }
  } catch {}

  foreach ($candidate in $candidates) {
    if (Test-PsbCepSource -Path $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  $searchRoots = @()
  $searchRoots += $PluginRoot
  try {
    $cwd2 = (Get-Location).Path
    if ($cwd2 -and $cwd2 -ne $PluginRoot) {
      $searchRoots += $cwd2
    }
  } catch {}

  foreach ($root in $searchRoots | Select-Object -Unique) {
    if (!(Test-Path -LiteralPath $root -PathType Container)) {
      continue
    }
    $matches = Get-ChildItem -LiteralPath $root -Directory -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like "*psb-smart-object-tools*" }
    foreach ($match in $matches) {
      $possible = @($match.FullName, (Join-Path $match.FullName "cep"))
      foreach ($path in $possible) {
        if (Test-PsbCepSource -Path $path) {
          return (Resolve-Path -LiteralPath $path).Path
        }
      }
    }
  }

  throw "PSB plugin source not found. Need a folder named like psb-smart-object-tools with index.html, js\main.js, CSXS\manifest.xml and jsx\link-smart-objects.jsx."
}

function Find-PsbUxpSource {
  $candidates = @()
  $candidates += Join-Path $PluginRoot "assets\psb-smart-object-tools\uxp"
  $candidates += Join-Path $PluginRoot "assets\psb-smart-object-tools\uxp-preview"

  try {
    $cwd = (Get-Location).Path
    if ($cwd) {
      $candidates += Join-Path $cwd "plugins\dumik-team-plugin\assets\psb-smart-object-tools\uxp"
      $candidates += Join-Path $cwd "assets\psb-smart-object-tools\uxp"
    }
  } catch {}

  foreach ($candidate in $candidates) {
    if (Test-PsbUxpSource -Path $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "PSB UXP source not found. Need assets\psb-smart-object-tools\uxp with manifest.json, index.html and js\main.js."
}

function Resolve-Flavor {
  if ($Flavor -ne "Auto") {
    return $Flavor
  }
  if ($IsMacOS) {
    return "UXP"
  }
  return "CEP"
}

function Assert-SafeCepPath {
  param([string]$Path)

  $root = (Resolve-Path -LiteralPath $TargetRoot).Path.TrimEnd("\")
  $resolved = (Resolve-Path -LiteralPath $Path).Path.TrimEnd("\")
  if ($resolved -ne $root -and !$resolved.StartsWith($root + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refuse to remove path outside CEP extensions: $resolved"
  }
}

function Remove-ExistingPluginAndBackups {
  $paths = @()
  if (Test-Path -LiteralPath $Target) {
    $paths += (Get-Item -LiteralPath $Target)
  }
  $paths += @(Get-ChildItem -LiteralPath $TargetRoot -Directory -Filter $BackupPattern -ErrorAction SilentlyContinue)

  foreach ($item in $paths) {
    Assert-SafeCepPath -Path $item.FullName
    Remove-Item -LiteralPath $item.FullName -Recurse -Force
    Write-Host "Removed old plugin: $($item.FullName)"
  }
  return $paths.Count
}

function Assert-RequiredFiles {
  param([string]$Root)

  foreach ($file in $RequiredFiles) {
    $path = Join-Path $Root $file
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "Required file missing: $path"
    }
  }
}

function Count-Files {
  param([string]$Root)
  return @(Get-ChildItem -LiteralPath $Root -File -Recurse -ErrorAction Stop).Count
}

function Assert-KeyFileHashes {
  param(
    [string]$SourceRoot,
    [string]$TargetRootPath
  )

  foreach ($file in $KeyFiles) {
    $sourceFile = Join-Path $SourceRoot $file
    $targetFile = Join-Path $TargetRootPath $file
    $sourceHash = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
    $targetHash = (Get-FileHash -LiteralPath $targetFile -Algorithm SHA256).Hash
    if ($sourceHash -ne $targetHash) {
      throw "Hash mismatch: $file"
    }
  }
}

function Enable-CepDebugMode {
  if ($env:OS -notlike "*Windows*") {
    return @()
  }

  $versions = 6..15
  $updated = @()
  foreach ($version in $versions) {
    $path = "HKCU:\Software\Adobe\CSXS.$version"
    if (!(Test-Path -LiteralPath $path)) {
      New-Item -Path $path -Force | Out-Null
    }
    New-ItemProperty -LiteralPath $path -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force | Out-Null
    $updated += "CSXS.$version"
  }
  return $updated
}

function Assert-UxpFiles {
  param([string]$Root)

  foreach ($file in @("manifest.json", "index.html", "js\main.js")) {
    $path = Join-Path $Root $file
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "Required UXP file missing: $path"
    }
  }
}

function Get-UxpVersion {
  param([string]$SourceRoot)
  try {
    $manifest = Get-Content -LiteralPath (Join-Path $SourceRoot "manifest.json") -Raw | ConvertFrom-Json
    return [string]$manifest.version
  } catch {
    return "dev"
  }
}

function New-UxpPackage {
  param([string]$SourceRoot)

  New-Item -ItemType Directory -Force -Path $UxpPackageRoot | Out-Null
  $version = Get-UxpVersion -SourceRoot $SourceRoot
  $package = Join-Path $UxpPackageRoot ("psb-smart-object-tools-uxp-$version.ccx")
  if (Test-Path -LiteralPath $package) {
    Remove-Item -LiteralPath $package -Force
  }

  $tempZip = Join-Path $UxpPackageRoot ("psb-smart-object-tools-uxp-$version.zip")
  if (Test-Path -LiteralPath $tempZip) {
    Remove-Item -LiteralPath $tempZip -Force
  }

  Compress-Archive -Path (Join-Path $SourceRoot "*") -DestinationPath $tempZip -Force
  Move-Item -LiteralPath $tempZip -Destination $package -Force
  return $package
}

function Find-Upia {
  $candidates = @()
  if ($IsMacOS) {
    $candidates += "/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent"
    $candidates += "/Library/Application Support/Adobe/Adobe Desktop Common/UPI/AdobePluginInstallerAgent"
  } else {
    $programFiles = @($env:ProgramFiles, ${env:ProgramFiles(x86)}) | Where-Object { $_ }
    foreach ($root in $programFiles) {
      $candidates += Join-Path $root "Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
      $candidates += Join-Path $root "Common Files\Adobe\Adobe Desktop Common\UPI\AdobePluginInstallerAgent.exe"
    }
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return $candidate
    }
  }
  return $null
}

function Install-UxpPackage {
  param([string]$PackagePath)

  $upia = Find-Upia
  if (!$upia) {
    Write-Host "UPIA not found. CCX package created only."
    Write-Host "Package: $PackagePath"
    return $false
  }

  if ($IsMacOS) {
    & $upia --install $PackagePath
  } else {
    & $upia /install $PackagePath
  }
  if ($LASTEXITCODE -ne 0) {
    throw "UPIA install failed. Exit code: $LASTEXITCODE"
  }
  return $true
}

$ResolvedFlavor = Resolve-Flavor

if ($ResolvedFlavor -eq "UXP") {
  $Source = Find-PsbUxpSource
  Assert-UxpFiles -Root $Source
  $packagePath = New-UxpPackage -SourceRoot $Source

  if ($CheckOnly) {
    Write-Host "Check OK."
    Write-Host "Flavor: UXP"
    Write-Host "Source: $Source"
    Write-Host "Package: $packagePath"
    Write-Host "Install: CCX via UPIA or double click"
    exit 0
  }

  $installed = Install-UxpPackage -PackagePath $packagePath
  Write-Host "Install OK."
  Write-Host "Flavor: UXP"
  Write-Host "Source: $Source"
  Write-Host "Package: $packagePath"
  Write-Host "Installed by UPIA: $installed"
  Write-Host "Validation: passed"
  exit 0
}

$Source = Find-PsbCepSource
Assert-RequiredFiles -Root $Source

if ($CheckOnly) {
  Write-Host "Check OK."
  Write-Host "Flavor: CEP"
  Write-Host "Source: $Source"
  Write-Host "Target: $Target"
  Write-Host "Mode: $Mode"
  exit 0
}

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

$removedCount = 0
if ($Mode -eq "Update" -or (Test-Path -LiteralPath $Target)) {
  $removedCount = Remove-ExistingPluginAndBackups
}

Copy-Item -LiteralPath $Source -Destination $Target -Recurse

Assert-RequiredFiles -Root $Target
$sourceCount = Count-Files -Root $Source
$targetCount = Count-Files -Root $Target
if ($sourceCount -ne $targetCount) {
  throw "File count mismatch. Source=$sourceCount Target=$targetCount"
}
Assert-KeyFileHashes -SourceRoot $Source -TargetRootPath $Target
$debugVersions = Enable-CepDebugMode

Write-Host "Install OK."
Write-Host "Flavor: CEP"
Write-Host "Source: $Source"
Write-Host "Target: $Target"
Write-Host "Removed old version count: $removedCount"
Write-Host "Validation: passed"
Write-Host "File count: $targetCount"
if ($debugVersions.Count) {
  Write-Host "CEP debug enabled: $($debugVersions -join ', ')"
}
