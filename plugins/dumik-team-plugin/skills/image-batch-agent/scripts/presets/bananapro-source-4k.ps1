param(
  [Parameter(Mandatory=$true)][string]$Image,
  [string[]]$Reference = @(),
  [string]$Prompt,
  [string]$PromptFile,
  [int]$Count = 1,
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$Task = ''
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Generator = Join-Path (Split-Path -Parent $ScriptDir) 'generate_batch_images.py'

$argsList = @(
  $Generator,
  '--image', $Image,
  '--image-model', 'bananapro',
  '--output-size', 'source-4k',
  '--count', $Count,
  '--out', $Out
)

foreach ($ref in $Reference) {
  $argsList += @('--reference', $ref)
}

if ($PromptFile) {
  $argsList += @('--prompt-file', $PromptFile)
} elseif ($Prompt) {
  $argsList += @('--prompt', $Prompt)
} else {
  throw 'Use -Prompt or -PromptFile.'
}

if ($Task) {
  $argsList += @('--task', $Task)
}

python @argsList
