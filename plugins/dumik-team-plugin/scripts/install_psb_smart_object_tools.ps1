param(
  [switch]$CheckOnly,
  [ValidateSet("Install", "Update")]
  [string]$Mode = "Install",
  [switch]$Update
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginRoot = Split-Path -Parent $ScriptDir
$Source = Join-Path $PluginRoot "assets\psb-smart-object-tools\cep"
$TargetRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$Target = Join-Path $TargetRoot "psb-smart-object-tools"
$BackupPattern = "psb-smart-object-tools.bak-*"

if ($Update) {
  $Mode = "Update"
}

function Assert-SafeCepPath {
  param([string]$Path)

  $root = (Resolve-Path -LiteralPath $TargetRoot).Path.TrimEnd("\")
  $resolved = (Resolve-Path -LiteralPath $Path).Path.TrimEnd("\")
  if ($resolved -ne $root -and !$resolved.StartsWith($root + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refuse to remove path outside CEP extensions: $resolved"
  }
}

function Remove-ExistingPlugin {
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
}

if (!(Test-Path -LiteralPath $Source)) {
  throw "Plugin source not found: $Source"
}

$Manifest = Join-Path $Source "CSXS\manifest.xml"
if (!(Test-Path -LiteralPath $Manifest)) {
  throw "CEP manifest not found: $Manifest"
}

if ($CheckOnly) {
  Write-Host "Check OK."
  Write-Host "Source: $Source"
  Write-Host "Target: $Target"
  Write-Host "Mode: $Mode"
  exit 0
}

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

if ($Mode -eq "Update") {
  Remove-ExistingPlugin
} elseif (Test-Path -LiteralPath $Target) {
  $Backup = "$Target.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Move-Item -LiteralPath $Target -Destination $Backup
  Write-Host "Old version backed up: $Backup"
}

Copy-Item -LiteralPath $Source -Destination $Target -Recurse

Write-Host "Installed: $Target"
Write-Host "Restart Photoshop, then open: Window > Extensions (Legacy) > PSB Smart Object Tools"
Write-Host "If Photoshop 2026 hides legacy extensions, check whether CEP extensions are allowed."
