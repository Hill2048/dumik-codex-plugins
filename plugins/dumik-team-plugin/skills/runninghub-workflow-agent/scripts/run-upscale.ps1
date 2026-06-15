param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ImagePath,

  [int]$ReduceSize = 1500,
  [int]$UpscaleSize = 4000,

  # 不传时自动从仓库根的 CURRENT_PROJECT.md 解析当前项目路径
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

# scripts -> runninghub-workflow-agent -> skills -> dumik-team-plugin -> plugins -> 仓库根
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\..")).Path

if (-not $OutDir) {
  $cur = Join-Path $repoRoot "CURRENT_PROJECT.md"
  if (-not (Test-Path $cur)) {
    throw "未传 -OutDir，且找不到 $cur，无法确定输出目录"
  }
  $m = Select-String -Path $cur -Pattern '项目路径：\s*`?([^`\r\n]+?)`?\s*$' | Select-Object -First 1
  if (-not $m) {
    throw "未传 -OutDir，且 CURRENT_PROJECT.md 里解析不到“项目路径：”，无法确定输出目录"
  }
  $projPath = $m.Matches[0].Groups[1].Value.Trim()
  $OutDir = Join-Path $repoRoot (Join-Path $projPath "输出\成品\runninghub-upscale")
}

$script = Join-Path $PSScriptRoot "run_runninghub_workflow.py"

python $script --preset upscale --image $ImagePath --reduce-size $ReduceSize --upscale-size $UpscaleSize --out-dir $OutDir
