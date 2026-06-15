#!/usr/bin/env python3
"""
Create PowerShell shortcuts for common image model and size combinations.
"""

from __future__ import annotations

from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PRESET_DIR = SCRIPT_DIR / "presets"
GENERATOR = SCRIPT_DIR / "generate_batch_images.py"

MODELS = {
    "image2": "image2",
    "banana": "banana",
    "banana-vip": "banana-vip",
    "banana-vip-2k": "banana-vip-2k",
    "banana-vip-4k": "banana-vip-4k",
    "bananapro": "bananapro",
    "bananapro-vip": "bananapro-vip",
}

SIZES = {
    "2k-square": "2K",
    "4k-9x16": "9:16-storyboard",
    "4k-16x9": "16:9-storyboard",
    "source-2k": "source-2k",
    "source-4k": "source-4k",
}


def ps_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def render_script(model_name: str, model_value: str, size_name: str, size_value: str) -> str:
    return f"""param(
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
  '--image-model', {ps_quote(model_value)},
  '--output-size', {ps_quote(size_value)},
  '--count', $Count,
  '--out', $Out
)

foreach ($ref in $Reference) {{
  $argsList += @('--reference', $ref)
}}

if ($PromptFile) {{
  $argsList += @('--prompt-file', $PromptFile)
}} elseif ($Prompt) {{
  $argsList += @('--prompt', $Prompt)
}} else {{
  throw 'Use -Prompt or -PromptFile.'
}}

if ($Task) {{
  $argsList += @('--task', $Task)
}}

python @argsList
"""


def main() -> None:
    if not GENERATOR.exists():
        raise SystemExit(f"Missing generator: {GENERATOR}")
    PRESET_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for model_name, model_value in MODELS.items():
        for size_name, size_value in SIZES.items():
            path = PRESET_DIR / f"{model_name}-{size_name}.ps1"
            path.write_text(render_script(model_name, model_value, size_name, size_value), encoding="utf-8")
            written.append(path)
    index_lines = [
        "# Image Generation Preset Scripts",
        "",
        "These shortcuts wrap `generate_batch_images.py` so agents do not manually calculate model and size parameters.",
        "",
        "Common fastest path:",
        "",
        "```powershell",
        ".\\bananapro-source-2k.ps1 -Image \"<target>\" -Reference \"<ref>\" -PromptFile \"<prompt.txt>\" -Count 3 -Out \"<out>\\confirm.png\"",
        "```",
        "",
        "Generated scripts:",
        "",
    ]
    index_lines.extend(f"- `{path.name}`" for path in written)
    (PRESET_DIR / "README.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(written)} preset scripts to {PRESET_DIR}")


if __name__ == "__main__":
    main()
