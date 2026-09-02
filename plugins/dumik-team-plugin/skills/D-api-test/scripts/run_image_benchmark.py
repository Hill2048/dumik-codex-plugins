from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageStat


SKILL_DIR = Path(__file__).resolve().parent.parent
PLUGIN_SKILLS_DIR = SKILL_DIR.parent
IMAGE_RUNNER = PLUGIN_SKILLS_DIR / "D-image-run" / "scripts" / "generate_batch_images.py"
FIXTURE_DIR = SKILL_DIR / "assets" / "image-edit-cookware"
TARGET_IMAGE = FIXTURE_DIR / "image1-target.png"
REFERENCE_IMAGE = FIXTURE_DIR / "image2-reference.png"

MODELS = {
    "flash": "gemini-3.1-flash-image-preview",
    "pro": "gemini-3-pro-image-preview",
}

MATRIX = [
    ("1K", "1:1", "1024x1024"),
    ("2K", "1:1", "2048x2048"),
    ("4K", "1:1", "4096x4096"),
    ("1K", "3:4", "768x1024"),
    ("2K", "3:4", "1536x2048"),
    ("4K", "3:4", "3072x4096"),
    ("1K", "16:9", "1024x576"),
    ("2K", "16:9", "2048x1152"),
    ("4K", "16:9", "4096x2304"),
]

PROMPT_BODY = """image1：目标图，锁定炒锅、锅铲、手部、机位与厨房环境。
image2：菜品参考，只控制番茄炒蛋的食材形态、色泽与熟度。

以 image1 为目标图做局部食材替换，保持 image1 的炒锅结构、灰色不粘锅内壁、锅铲位置、右侧手部、俯拍角度、裁切、灶台和背景不变。将锅内全部青椒炒肉替换为 image2 中已经炒好的番茄炒蛋：金黄柔嫩的炒蛋块、熟透但保持块状的红色番茄、少量自然橙红汤汁，按照 image1 原有锅内面积和翻炒分布自然铺在锅底，食材与锅面接触真实，锅铲仍处于翻炒动作，食材的透视、光线、景深和清晰度与 image1 完全一致。

约束：不要保留青椒或肉丝；不要复制 image2 的白盘、桌面和背景；不要改变锅体、锅铲、手、灶台和相机角度；不要新增文字、水印或无关食材。"""


def ratio_slug(ratio: str) -> str:
    return ratio.replace(":", "x")


def build_items(model_slug: str) -> list[dict[str, Any]]:
    items = []
    for size_label, ratio, output_size in MATRIX:
        item_id = f"{model_slug}-{size_label.lower()}-{ratio_slug(ratio)}"
        items.append(
            {
                "id": item_id,
                "file": str(TARGET_IMAGE),
                "reference_files": [str(REFERENCE_IMAGE)],
                "task": f"API 图片基准 {model_slug} {size_label} {ratio}",
                "count": 1,
                "output_name": f"{item_id}.png",
                "output_size": output_size,
                "final_instruction": f"比例：{ratio}\n\n{PROMPT_BODY}",
            }
        )
    return items


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def run_model(
    *,
    model_slug: str,
    model_name: str,
    base_url: str,
    api_key: str | None,
    output_root: Path,
    concurrency: int,
    timeout_seconds: int,
) -> int:
    task_file = output_root / f"{model_slug}-tasks.json"
    write_json(task_file, {"items": build_items(model_slug)})
    command = [
        sys.executable,
        str(IMAGE_RUNNER),
        "--batch",
        "--results-input",
        str(task_file),
        "--output-dir",
        str(output_root / model_slug),
        "--image-model",
        model_name,
        "--base-url",
        base_url,
        "--concurrency",
        str(concurrency),
    ]
    child_env = os.environ.copy()
    if api_key:
        credential_home = output_root / ".credential-isolation"
        credential_home.mkdir(parents=True, exist_ok=True)
        child_env["CODEX_HOME"] = str(credential_home)
        child_env["JUAIHUB_API_KEY"] = api_key
    try:
        return subprocess.run(
            command,
            check=False,
            env=child_env,
            timeout=timeout_seconds,
        ).returncode
    except subprocess.TimeoutExpired:
        print(f"Model {model_slug} exceeded {timeout_seconds}s and was stopped.")
        return 124


def requested_ratio(row: dict[str, Any]) -> float:
    width, height = (int(value) for value in row["output_size"].split("x", 1))
    return width / height


def inspect_row(row: dict[str, Any]) -> dict[str, Any]:
    generated = row.get("generated_files") or []
    result = {
        "id": row.get("id"),
        "model": row.get("image_model"),
        "requested_size": row.get("output_size"),
        "actual_size": None,
        "seconds": (row.get("timing") or {}).get("total_seconds"),
        "ratio_error_pct": None,
        "nonblank_score": None,
        "technical_pass": False,
        "semantic_qa": "pending_visual_review",
        "file": generated[0] if generated else None,
        "error": row.get("error"),
    }
    if len(generated) != 1:
        return result
    try:
        image_path = Path(generated[0])
        with Image.open(image_path) as image:
            image.load()
            width, height = image.size
            actual_ratio = width / height
            target_ratio = requested_ratio(row)
            ratio_error = abs(actual_ratio - target_ratio) / target_ratio * 100
            nonblank_score = sum(ImageStat.Stat(image.convert("RGB")).stddev)
        result.update(
            {
                "actual_size": f"{width}x{height}",
                "ratio_error_pct": round(ratio_error, 3),
                "nonblank_score": round(nonblank_score, 3),
                "technical_pass": ratio_error <= 3 and nonblank_score > 3,
            }
        )
    except (OSError, ValueError) as exc:
        result["error"] = f"Image validation failed: {exc}"
    return result


def load_rows(
    output_root: Path,
    model_slugs: list[str],
    model_names: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    rows = []
    for model_slug in model_slugs:
        record_path = output_root / model_slug / "运行记录.json"
        records = json.loads(record_path.read_text(encoding="utf-8")) if record_path.exists() else []
        records_by_id = {record.get("id"): record for record in records}
        task_path = output_root / f"{model_slug}-tasks.json"
        tasks = json.loads(task_path.read_text(encoding="utf-8")).get("items", [])
        for task in tasks:
            record = records_by_id.get(task.get("id"))
            if record:
                rows.append(inspect_row(record))
                continue
            candidates = sorted((output_root / model_slug).glob(f"{task['id']}.*"))
            generated = [str(candidates[0].resolve())] if candidates else []
            recovered = {
                **task,
                "image_model": (model_names or {}).get(model_slug),
                "generated_files": generated,
                "timing": {},
                "error": None if generated else "No result before model run ended.",
            }
            rows.append(inspect_row(recovered))
    return rows


def model_summary(rows: list[dict[str, Any]], model_slug: str) -> dict[str, Any]:
    selected = [row for row in rows if str(row["id"]).startswith(f"{model_slug}-")]
    timings = [float(row["seconds"]) for row in selected if row["seconds"] is not None]
    return {
        "model": model_slug,
        "requests": len(selected),
        "technical_pass": sum(bool(row["technical_pass"]) for row in selected),
        "average_seconds": round(statistics.mean(timings), 2) if timings else None,
        "median_seconds": round(statistics.median(timings), 2) if timings else None,
        "min_seconds": round(min(timings), 2) if timings else None,
        "max_seconds": round(max(timings), 2) if timings else None,
    }


def write_markdown_summary(path: Path, report: dict[str, Any]) -> None:
    lines = [
        "# 图片 API 基准结果",
        "",
        f"- 接口：`{report['base_url']}`",
        f"- 时间：`{report['created_at']}`",
        "- 测试题：双参考图，把 image1 锅内食材替换成 image2 的番茄炒蛋。",
        "- 画面结论：待人工查看九宫格后填写，技术通过不代表画面通过。",
        "",
        "## 汇总",
        "",
        "| 模型 | 技术通过 | 平均秒 | 中位秒 | 最快秒 | 最慢秒 |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for item in report["models"]:
        lines.append(
            f"| {item['model']} | {item['technical_pass']}/{item['requests']} | "
            f"{item['average_seconds']} | {item['median_seconds']} | "
            f"{item['min_seconds']} | {item['max_seconds']} |"
        )
    lines.extend(
        [
            "",
            "## 明细",
            "",
            "| 任务 | 请求尺寸 | 实际尺寸 | 比例误差 | 秒 | 技术通过 |",
            "| --- | --- | --- | ---: | ---: | --- |",
        ]
    )
    for row in report["rows"]:
        lines.append(
            f"| {row['id']} | {row['requested_size']} | {row['actual_size'] or '-'} | "
            f"{row['ratio_error_pct'] if row['ratio_error_pct'] is not None else '-'}% | "
            f"{row['seconds'] if row['seconds'] is not None else '-'} | "
            f"{'是' if row['technical_pass'] else '否'} |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def create_contact_sheet(output_root: Path, rows: list[dict[str, Any]], model_slug: str) -> None:
    selected = {row["id"]: row for row in rows if str(row["id"]).startswith(f"{model_slug}-")}
    sheet = Image.new("RGB", (1800, 1350), "#f4f4f4")
    draw = ImageDraw.Draw(sheet)
    font = load_font(24)
    ratios = ["1x1", "3x4", "16x9"]
    sizes = ["1k", "2k", "4k"]
    for row_index, ratio in enumerate(ratios):
        for column_index, size in enumerate(sizes):
            row = selected.get(f"{model_slug}-{size}-{ratio}")
            if not row or not row["file"]:
                continue
            with Image.open(row["file"]) as source:
                image = source.convert("RGB")
            image.thumbnail((560, 390), Image.Resampling.LANCZOS)
            cell_x, cell_y = column_index * 600, row_index * 450
            x = cell_x + (600 - image.width) // 2
            y = cell_y + 48 + (390 - image.height) // 2
            sheet.paste(image, (x, y))
            label = f"{model_slug.upper()}  {size.upper()}  {ratio.replace('x', ':')}  {row['actual_size']}"
            draw.text((cell_x + 20, cell_y + 12), label, fill="#111111", font=font)
    sheet.save(output_root / f"{model_slug}-contact-sheet.jpg", quality=92)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the fixed DUMIK image API benchmark.")
    parser.add_argument("--base-url", required=True, help="Provider base URL; never stored with a key.")
    parser.add_argument("--models", nargs="+", choices=sorted(MODELS), default=["flash", "pro"])
    parser.add_argument("--flash-model", default=MODELS["flash"])
    parser.add_argument("--pro-model", default=MODELS["pro"])
    parser.add_argument("--api-key-env", default="DUMIK_API_TEST_KEY")
    parser.add_argument("--use-local-credentials", action="store_true")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--model-timeout-seconds", type=int, default=1800)
    parser.add_argument("--output-dir")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.concurrency < 1 or args.concurrency > 8:
        raise SystemExit("--concurrency must be between 1 and 8")
    if args.model_timeout_seconds < 1:
        raise SystemExit("--model-timeout-seconds must be positive")
    for required_path in (IMAGE_RUNNER, TARGET_IMAGE, REFERENCE_IMAGE):
        if not required_path.exists():
            raise SystemExit(f"Missing benchmark dependency: {required_path}")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    output_root = (
        Path(args.output_dir).resolve()
        if args.output_dir
        else Path.cwd() / "reports" / f"api-image-benchmark-{timestamp}"
    )
    output_root.mkdir(parents=True, exist_ok=True)

    model_names = {"flash": args.flash_model, "pro": args.pro_model}
    for model_slug in args.models:
        write_json(output_root / f"{model_slug}-tasks.json", {"items": build_items(model_slug)})
    if args.dry_run:
        print(f"Dry run complete: {len(args.models) * len(MATRIX)} tasks written to {output_root}")
        return 0

    api_key = None if args.use_local_credentials else os.getenv(args.api_key_env)
    if not args.use_local_credentials and not api_key:
        raise SystemExit(f"Missing API key environment variable: {args.api_key_env}")

    exit_codes = {}
    for model_slug in args.models:
        exit_codes[model_slug] = run_model(
            model_slug=model_slug,
            model_name=model_names[model_slug],
            base_url=args.base_url,
            api_key=api_key,
            output_root=output_root,
            concurrency=args.concurrency,
            timeout_seconds=args.model_timeout_seconds,
        )

    rows = load_rows(output_root, args.models, model_names)
    report = {
        "base_url": args.base_url,
        "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "matrix": {"sizes": ["1K", "2K", "4K"], "ratios": ["1:1", "3:4", "16:9"]},
        "models": [model_summary(rows, model_slug) for model_slug in args.models],
        "rows": rows,
        "runner_exit_codes": exit_codes,
        "secrets_stored": False,
    }
    write_json(output_root / "summary.json", report)
    write_markdown_summary(output_root / "summary.md", report)
    for model_slug in args.models:
        create_contact_sheet(output_root, rows, model_slug)

    failed = [row for row in rows if not row["technical_pass"]]
    print(f"Benchmark complete: {len(rows) - len(failed)}/{len(rows)} technical checks passed")
    print(f"Report: {output_root / 'summary.md'}")
    return 1 if failed or any(exit_codes.values()) else 0


if __name__ == "__main__":
    raise SystemExit(main())
