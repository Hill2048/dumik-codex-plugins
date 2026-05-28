#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any


DEFAULT_OUTPUT_DIR = Path.cwd() / "输出"
DEFAULT_MODEL = "seedance2.0fast_vip"
DEFAULT_RESOLUTION = "720p"
DEFAULT_RATIO = "3:4"
DEFAULT_DURATION = 5
DEFAULT_MODE = "multimodal2video"
DEFAULT_POLL = 20
ALLOWED_RATIOS = {"16:9", "3:4", "9:16"}


class BatchVideoError(Exception):
    pass


@dataclass
class VideoPromptItem:
    id: str
    file: str | None
    task: str
    count: int
    output_name: str
    ratio: str | None
    duration: int | None
    mode: str | None
    model_version: str | None
    video_resolution: str | None
    reference_images: list[str]
    reference_videos: list[str]
    reference_audios: list[str]
    final_instruction: str


def load_prompt_items(path: Path) -> list[VideoPromptItem]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise BatchVideoError(f"Results input not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise BatchVideoError(f"Results input JSON is invalid: {exc}") from exc

    rows = raw.get("items") if isinstance(raw, dict) else raw
    if not isinstance(rows, list) or not rows:
        raise BatchVideoError("Results input must be a non-empty array or an object with 'items'.")

    items: list[VideoPromptItem] = []
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise BatchVideoError(f"Results item {index} must be an object.")

        item_id = str(row.get("id") or f"item-{index:03d}")
        final_instruction = str(row.get("final_instruction") or "").strip()
        if not final_instruction:
            raise BatchVideoError(f"Results item {item_id} is missing 'final_instruction'.")

        count = int(row.get("count") or 1)
        if count < 1 or count > 4:
            raise BatchVideoError(f"Results item {item_id} count must be between 1 and 4.")

        ratio = str(row.get("ratio") or DEFAULT_RATIO).strip()
        if ratio not in ALLOWED_RATIOS:
            raise BatchVideoError(
                f"Results item {item_id} ratio must be one of: {', '.join(sorted(ALLOWED_RATIOS))}."
            )

        items.append(
            VideoPromptItem(
                id=item_id,
                file=str(row.get("file")).strip() if row.get("file") else None,
                task=str(row.get("task") or "").strip(),
                count=count,
                output_name=str(row.get("output_name") or item_id).strip(),
                ratio=ratio,
                duration=int(row.get("duration") or DEFAULT_DURATION),
                mode=str(row.get("mode") or DEFAULT_MODE).strip(),
                model_version=str(row.get("model_version") or DEFAULT_MODEL).strip(),
                video_resolution=str(row.get("video_resolution") or DEFAULT_RESOLUTION).strip(),
                reference_images=[str(x).strip() for x in (row.get("reference_images") or []) if str(x).strip()],
                reference_videos=[str(x).strip() for x in (row.get("reference_videos") or []) if str(x).strip()],
                reference_audios=[str(x).strip() for x in (row.get("reference_audios") or []) if str(x).strip()],
                final_instruction=final_instruction,
            )
        )
    return items


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_json_blob(text: str) -> Any:
    text = text.strip()
    if not text:
        raise BatchVideoError("Dreamina returned empty output.")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        decoder = json.JSONDecoder()
        for start in range(len(text)):
            if text[start] not in "[{":
                continue
            try:
                obj, end = decoder.raw_decode(text[start:])
            except json.JSONDecodeError:
                continue
            if text[start + end :].strip():
                return obj
            return obj
    raise BatchVideoError("Dreamina output is not valid JSON.")


def normalize_task_result(data: Any) -> dict[str, Any]:
    if isinstance(data, list):
        return {"items": data}
    if isinstance(data, dict):
        return data
    return {"raw": data}


def build_command(item: VideoPromptItem, poll: int) -> list[str]:
    cmd = [
        "dreamina",
        item.mode if item.mode in {"multimodal2video", "image2video"} else DEFAULT_MODE,
    ]
    if item.mode not in {"multimodal2video", "image2video"}:
        raise BatchVideoError(f"Unsupported mode for {item.id}: {item.mode}")

    if item.mode == "multimodal2video":
        if not item.file and not item.reference_images and not item.reference_videos:
            raise BatchVideoError(f"multimodal2video requires at least one image or video input for {item.id}")
        if item.file:
            cmd.extend(["--image", item.file])
        for image_path in item.reference_images:
            cmd.extend(["--image", image_path])
        for video_path in item.reference_videos:
            cmd.extend(["--video", video_path])
        for audio_path in item.reference_audios:
            cmd.extend(["--audio", audio_path])
        cmd.extend(
            [
                "--prompt",
                item.final_instruction,
                "--duration",
                str(item.duration or DEFAULT_DURATION),
                "--ratio",
                item.ratio or DEFAULT_RATIO,
                "--video_resolution",
                item.video_resolution or DEFAULT_RESOLUTION,
                "--model_version",
                item.model_version or DEFAULT_MODEL,
                "--poll",
                str(poll),
            ]
        )
        return cmd

    if not item.file:
        raise BatchVideoError(f"image2video requires a primary frame image for {item.id}")
    cmd.extend(
        [
            "--image",
            item.file,
            "--prompt",
            item.final_instruction,
            "--duration",
            str(item.duration or DEFAULT_DURATION),
            "--video_resolution",
            item.video_resolution or DEFAULT_RESOLUTION,
            "--model_version",
            item.model_version or DEFAULT_MODEL,
            "--poll",
            str(poll),
        ]
    )
    return cmd


def run_dreamina_submit(item: VideoPromptItem, output_dir: Path, poll: int) -> dict[str, Any]:
    item_dir = output_dir / Path(item.output_name).stem
    item_dir.mkdir(parents=True, exist_ok=True)
    command = build_command(item, poll)
    completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()
    if completed.returncode != 0 and not stdout:
        raise BatchVideoError(stderr or f"Dreamina failed for {item.id}")

    payload = parse_json_blob(stdout or stderr)
    normalized = normalize_task_result(payload)
    submit_id = normalized.get("submit_id")
    if not submit_id:
        raise BatchVideoError(f"Dreamina output missing submit_id for {item.id}")

    query = subprocess.run(
        [
            "dreamina",
            "query_result",
            f"--submit_id={submit_id}",
            f"--download_dir={item_dir}",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    query_payload = parse_json_blob(query.stdout.strip() or query.stderr.strip())
    query_result = normalize_task_result(query_payload)

    downloaded = [str(path.resolve()) for path in item_dir.rglob("*") if path.is_file()]
    return {
        "id": item.id,
        "output_dir": str(item_dir.resolve()),
        "submit_id": submit_id,
        "submit_result": normalized,
        "query_result": query_result,
        "downloaded_files": downloaded,
        "submitted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def write_markdown(path: Path, rows: list[dict[str, Any]]) -> None:
    lines = [
        "# Video Batch Agent Results",
        "",
        f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
    ]
    for row in rows:
        lines.extend(
            [
                f"## {row['id']}",
                "",
                f"- 提交 ID: {row.get('submit_id') or '未生成'}",
                f"- 输出目录: {row.get('output_dir') or '未生成'}",
                "",
            ]
        )
        if row.get("downloaded_files"):
            lines.append("- 文件:")
            for file_path in row["downloaded_files"]:
                lines.append(f"  - {file_path}")
            lines.append("")
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
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Dreamina videos in batch from finished prompts.")
    parser.add_argument("--results-input", required=True, help="JSON file with finished prompts.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Where to store downloads and logs.")
    parser.add_argument("--poll", type=int, default=DEFAULT_POLL, help="Seconds to wait briefly after submit.")
    args = parser.parse_args()

    input_path = Path(args.results_input).resolve()
    output_dir = Path(args.output_dir).resolve()
    items = load_prompt_items(input_path)

    results: list[dict[str, Any]] = []
    for item in items:
        for index in range(item.count):
            if item.count == 1:
                current = item
            else:
                stem = Path(item.output_name).stem
                current = VideoPromptItem(
                    **{
                        **asdict(item),
                        "id": f"{item.id}-{index + 1:02d}",
                        "output_name": f"{stem}-{index + 1:02d}",
                    }
                )
            result = run_dreamina_submit(current, output_dir, args.poll)
            result["final_instruction"] = current.final_instruction
            results.append(result)

    write_json(output_dir / "运行记录.json", results)
    write_markdown(output_dir / "运行记录.md", results)
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except BatchVideoError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
