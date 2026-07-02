param(
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginRoot = Split-Path -Parent $ScriptDir
$Source = Join-Path $PluginRoot "assets\psb-smart-object-tools\cep"
$TargetRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$Target = Join-Path $TargetRoot "psb-smart-object-tools"

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
  exit 0
}

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

if (Test-Path -LiteralPath $Target) {
  $Backup = "$Target.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Move-Item -LiteralPath $Target -Destination $Backup
  Write-Host "Old version backed up: $Backup"
}

Copy-Item -LiteralPath $Source -Destination $Target -Recurse

Write-Host "Installed: $Target"
Write-Host "Restart Photoshop, then open: Window > Extensions (Legacy) > PSB Smart Object Tools"
Write-Host "If Photoshop 2026 hides legacy extensions, check whether CEP extensions are allowed."
