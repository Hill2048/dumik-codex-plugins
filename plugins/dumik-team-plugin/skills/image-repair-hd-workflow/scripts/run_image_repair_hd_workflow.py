#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
IMAGE_BATCH_SCRIPT = ROOT / "image-batch-agent" / "scripts" / "generate_batch_images.py"


def run_command(args: list[str], cwd: Path) -> None:
    result = subprocess.run(args, cwd=str(cwd), check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def build_lineart_prompt(subject_hint: str | None = None) -> str:
    parts = [
        "把原图转化为干净流畅的纯线稿，仅保留黑白两色。",
        "确保黑白层次清晰、线条干净、结构稳定、边缘明确。",
        "去除多余杂色、灰脏感、渐变和脏污纹理。",
        "保持原图主体造型、比例、透视、结构关系不变。",
        "不要上色，不要阴影，不要材质纹理，只输出高清黑白线稿。",
    ]
    if subject_hint:
        parts.append(f"主体补充说明：{subject_hint.strip()}。")
    return "".join(parts)


def build_reverse_prompt(subject_hint: str | None = None) -> str:
    parts = [
        "请根据原图反推出一份中文提示词，准确描述主体、材质、色调、光影、构图、镜头感和画面氛围。",
        "不要写流程说明，不要写操作建议，只输出可直接用于生图的中文提示词正文。",
    ]
    if subject_hint:
        parts.append(f"主体补充说明：{subject_hint.strip()}。")
    return "\n".join(parts)


def build_final_prompt(reverse_prompt: str) -> str:
    return (
        "请你根据图片1的线稿结构，还原主体造型、轮廓、比例和边缘关系；"
        "根据图片2的固有色关系恢复配色、明暗和整体光影；"
        "最后生成一张高清、干净、无脏污、无灰感、边缘清晰、材质明确的最终图。"
        "保持主体结构稳定，不要改造型，不要改比例，不要引入额外元素。"
        f"主体与画面描述：{reverse_prompt.strip()}"
    )


def blur_solid_color(image_path: Path, output_path: Path, radius: float) -> None:
    with Image.open(image_path) as image:
        image = image.convert("RGB")
        blurred = image.filter(ImageFilter.GaussianBlur(radius=radius))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        blurred.save(output_path)


def call_image_batch(
    *,
    image: Path,
    references: list[Path],
    prompt: str,
    image_model: str,
    output_size: str,
    out_path: Path,
) -> None:
    cmd = [
        sys.executable,
        str(IMAGE_BATCH_SCRIPT),
        "--image",
        str(image),
        "--prompt",
        prompt,
        "--image-model",
        image_model,
        "--output-size",
        output_size,
        "--out",
        str(out_path),
    ]
    for reference in references:
        cmd.extend(["--reference", str(reference)])
    run_command(cmd, cwd=IMAGE_BATCH_SCRIPT.parent)


def image2_safe_size(image_path: Path, long_edge: int = 2048) -> str:
    with Image.open(image_path) as image:
        width, height = image.size
    if width >= height:
        target_width = long_edge
        target_height = max(16, round(height * long_edge / width / 16) * 16)
        target_width = max(16, round(target_width / 16) * 16)
    else:
        target_height = long_edge
        target_width = max(16, round(width * long_edge / height / 16) * 16)
        target_height = max(16, round(target_height / 16) * 16)
    return f"{target_width}x{target_height}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the 4-step HD repair workflow.")
    parser.add_argument("--image", required=True, help="Source image path.")
    parser.add_argument("--output-dir", required=True, help="Workflow output directory.")
    parser.add_argument("--reverse-prompt", help="Existing Chinese reverse prompt.")
    parser.add_argument("--lineart-model", default="image2")
    parser.add_argument("--final-model", default="image2")
    parser.add_argument("--final-size")
    parser.add_argument("--blur-radius", type=float, default=10.0)
    parser.add_argument("--subject", help="Optional subject hint.")
    args = parser.parse_args()

    image_path = Path(args.image).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    lineart_path = output_dir / "01-lineart.png"
    solid_color_path = output_dir / "02-solid-color-blur.png"
    reverse_prompt_path = output_dir / "03-reverse-prompt.txt"
    final_prompt_path = output_dir / "04-final-prompt.txt"
    final_image_path = output_dir / "05-final.png"
    run_record_path = output_dir / "repair-run.json"

    lineart_prompt = build_lineart_prompt(args.subject)
    lineart_size = "source-2k"
    if args.lineart_model.lower() in {"image2", "gpt-image-2"}:
        lineart_size = image2_safe_size(image_path, long_edge=2048)
    call_image_batch(
        image=image_path,
        references=[],
        prompt=lineart_prompt,
        image_model=args.lineart_model,
        output_size=lineart_size,
        out_path=lineart_path,
    )

    blur_solid_color(image_path, solid_color_path, args.blur_radius)

    reverse_prompt = (args.reverse_prompt or "").strip()
    if not reverse_prompt:
        reverse_prompt = build_reverse_prompt(args.subject)
    reverse_prompt_path.write_text(reverse_prompt, encoding="utf-8")

    final_prompt = build_final_prompt(reverse_prompt)
    final_prompt_path.write_text(final_prompt, encoding="utf-8")

    final_size = args.final_size
    if not final_size and args.final_model.lower() in {"image2", "gpt-image-2"}:
        final_size = image2_safe_size(image_path, long_edge=2048)
    elif not final_size:
        final_size = "source-2k"

    call_image_batch(
        image=image_path,
        references=[lineart_path, solid_color_path],
        prompt=final_prompt,
        image_model=args.final_model,
        output_size=final_size,
        out_path=final_image_path,
    )

    run_record = {
        "image": str(image_path),
        "lineart_image": str(lineart_path),
        "solid_color_image": str(solid_color_path),
        "reverse_prompt_file": str(reverse_prompt_path),
        "final_prompt_file": str(final_prompt_path),
        "final_image": str(final_image_path),
        "lineart_model": args.lineart_model,
        "final_model": args.final_model,
        "final_size": final_size,
        "blur_radius": args.blur_radius,
        "subject": args.subject or "",
    }
    run_record_path.write_text(json.dumps(run_record, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
