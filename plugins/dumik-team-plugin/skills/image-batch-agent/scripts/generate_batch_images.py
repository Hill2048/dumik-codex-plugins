#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "requests>=2.28.1",
# ]
# ///
"""
Generate images in batch from a JSON file that already contains finished prompts.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import requests


DEFAULT_OUTPUT_DIR = Path.cwd() / "输出"
DEFAULT_BASE_URL = "https://api.juaihub.cn"
DEFAULT_IMAGE_MODEL = "gpt-image-2"


class BatchImageError(Exception):
    pass


@dataclass
class PromptItem:
    id: str
    file: str | None
    task: str
    count: int
    output_name: str
    final_instruction: str


def die(message: str, code: int = 1) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(code)


def load_prompt_items(path: Path) -> list[PromptItem]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise BatchImageError(f"Results input not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise BatchImageError(f"Results input JSON is invalid: {exc}") from exc

    rows = raw.get("items") if isinstance(raw, dict) else raw
    if not isinstance(rows, list) or not rows:
        raise BatchImageError("Results input must be a non-empty array or an object with 'items'.")

    items: list[PromptItem] = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise BatchImageError(f"Results item {index} must be an object.")

        item_id = str(row.get("id") or f"item-{index:03d}")
        final_instruction = str(row.get("final_instruction") or "").strip()
        if not final_instruction:
            raise BatchImageError(f"Results item {item_id} is missing 'final_instruction'.")

        count = int(row.get("count") or 1)
        if count < 1 or count > 8:
            raise BatchImageError(f"Results item {item_id} count must be between 1 and 8.")

        items.append(
            PromptItem(
                id=item_id,
                file=str(row.get("file")).strip() if row.get("file") else None,
                task=str(row.get("task") or "").strip(),
                count=count,
                output_name=str(row.get("output_name") or f"{item_id}.png").strip(),
                final_instruction=final_instruction,
            )
        )
    return items


def build_output_paths(output_dir: Path, output_name: str, count: int) -> list[Path]:
    base = output_dir / output_name
    if not base.suffix:
        base = base.with_suffix(".png")
    if count == 1:
        return [base]
    return [base.with_name(f"{base.stem}-{idx}{base.suffix}") for idx in range(1, count + 1)]


def save_b64_images(encoded_images: list[str], output_paths: list[Path]) -> list[str]:
    saved_paths: list[str] = []
    for idx, encoded in enumerate(encoded_images[: len(output_paths)]):
        if encoded.startswith("data:"):
            encoded = encoded.split(",", 1)[1]
        output_path = output_paths[idx]
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(base64.b64decode(encoded))
        saved_paths.append(str(output_path.resolve()))
    return saved_paths


def save_url_images(urls: list[str], output_paths: list[Path]) -> list[str]:
    saved_paths: list[str] = []
    for idx, url in enumerate(urls[: len(output_paths)]):
        response = requests.get(url, timeout=600)
        if response.status_code >= 400:
            raise BatchImageError(
                f"Image download failed ({response.status_code}): {response.text[:1200]}"
            )
        output_path = output_paths[idx]
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(response.content)
        saved_paths.append(str(output_path.resolve()))
    return saved_paths


def save_response_images(body: dict[str, Any], output_paths: list[Path]) -> list[str]:
    data = body.get("data", [])
    encoded_images = [item.get("b64_json") for item in data if item.get("b64_json")]
    if encoded_images:
        return save_b64_images(encoded_images, output_paths)

    urls = [item.get("url") for item in data if item.get("url")]
    if urls:
        return save_url_images(urls, output_paths)

    raise BatchImageError("Image API returned no image data.")


def generate_images(
    *,
    base_url: str,
    api_key: str,
    image_model: str,
    source_file: str | None,
    prompt: str,
    count: int,
    output_paths: list[Path],
) -> list[str]:
    headers = {"Authorization": f"Bearer {api_key}"}
    if source_file:
        image_path = Path(source_file)
        if not image_path.exists():
            raise BatchImageError(f"Source image not found: {source_file}")

        url = base_url.rstrip("/") + "/v1/images/edits"
        with image_path.open("rb") as image_file:
            response = requests.post(
                url,
                headers=headers,
                data={
                    "model": image_model,
                    "prompt": prompt,
                    "n": str(count),
                    "response_format": "b64_json",
                },
                files={"image": (image_path.name, image_file)},
                timeout=600,
            )
    else:
        url = base_url.rstrip("/") + "/v1/images/generations"
        response = requests.post(
            url,
            headers=headers,
            json={
                "model": image_model,
                "prompt": prompt,
                "n": count,
                "response_format": "b64_json",
            },
            timeout=600,
        )
    if response.status_code >= 400:
        raise BatchImageError(
            f"Image API request failed ({response.status_code}): {response.text[:1200]}"
        )

    return save_response_images(response.json(), output_paths)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_markdown(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [
        "# Image Batch Agent Results",
        "",
        f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
    ]
    for row in rows:
        lines.extend(
            [
                f"## {row['id']}",
                "",
                f"- 原图: {row.get('file') or '未提供'}",
                f"- 是否出图: {'是' if row.get('generated_files') else '否'}",
                "",
            ]
        )
        if row.get("task"):
            lines.extend([f"- 任务: {row['task']}", ""])
        if row.get("error"):
            lines.extend(["### 错误", "", row["error"], ""])
            continue
        lines.extend(
            [
                "### 最终提示词",
                "",
                "```txt",
                row.get("final_instruction", ""),
                "```",
                "",
            ]
        )
        if row.get("generated_files"):
            lines.append("### 结果文件")
            for file_path in row["generated_files"]:
                lines.append(f"- {file_path}")
            lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate images in batch from finished prompt rows."
    )
    parser.add_argument("--results-input", required=True, help="JSON file with final_instruction rows.")
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="OpenAI-compatible API base URL.",
    )
    parser.add_argument(
        "--image-model",
        default=DEFAULT_IMAGE_MODEL,
        help="Image model name.",
    )
    parser.add_argument(
        "--api-key",
        help="API key. Falls back to OPENAI_API_KEY.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory for generated images and logs.",
    )
    args = parser.parse_args()

    api_key = args.api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        die("Missing API key. Pass --api-key or set OPENAI_API_KEY.")

    try:
        prompt_items = load_prompt_items(Path(args.results_input).resolve())
    except BatchImageError as exc:
        die(str(exc))

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, Any]] = []
    for item in prompt_items:
        print(f"Generating {item.id}...")
        try:
            images = generate_images(
                base_url=args.base_url,
                api_key=api_key,
                image_model=args.image_model,
                source_file=item.file,
                prompt=item.final_instruction,
                count=item.count,
                output_paths=build_output_paths(output_dir, item.output_name, item.count),
            )
            rows.append(
                {
                    "id": item.id,
                    "file": item.file,
                    "task": item.task,
                    "count": item.count,
                    "output_name": item.output_name,
                    "final_instruction": item.final_instruction,
                    "generated_files": images,
                }
            )
        except BatchImageError as exc:
            rows.append(
                {
                    "id": item.id,
                    "file": item.file,
                    "task": item.task,
                    "count": item.count,
                    "output_name": item.output_name,
                    "final_instruction": item.final_instruction,
                    "error": str(exc),
                    "generated_files": [],
                }
            )

    write_json(output_dir / "运行记录.json", rows)
    write_markdown(output_dir / "运行记录.md", rows)
    print(f"Done. Results written to: {output_dir}")


if __name__ == "__main__":
    main()
