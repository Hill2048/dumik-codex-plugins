param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ImagePath,

  [int]$ReduceSize = 1500,
  [int]$UpscaleSize = 4000,

  # 不传时默认落到 Downloads
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

# scripts -> runninghub-workflow-agent -> skills -> dumik-team-plugin -> plugins -> 仓库根
if (-not $OutDir) {
  $downloads = Join-Path $env:USERPROFILE "Downloads"
  $OutDir = Join-Path $downloads ("runninghub\upscale-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
}

$script = Join-Path $PSScriptRoot "run_runninghub_workflow.py"

python $script --preset upscale --image $ImagePath --reduce-size $ReduceSize --upscale-size $UpscaleSize --out-dir $OutDir
