#!/usr/bin/env python3
"""
Create the fixed Chinese folder structure for an D-image-run project.
"""

from __future__ import annotations

import argparse
import re
from datetime import datetime
from pathlib import Path


DEFAULT_ROOT = Path(r"F:\AI HOME\CODEX\image\outputs\批量改图项目")


def clean_name(value: str) -> str:
    value = value.strip() or "批量改图"
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value or "批量改图"


def build_project_path(root: Path, project_name: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return root / f"{clean_name(project_name)}-{stamp}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Create project folders and output categories.")
    parser.add_argument("--project-name", help="Chinese project name.")
    parser.add_argument(
        "--root",
        default=str(DEFAULT_ROOT),
        help="Root folder for batch image projects.",
    )
    parser.add_argument(
        "--output-path",
        help="Exact confirmed project folder. Overrides --project-name and --root.",
    )
    args = parser.parse_args()

    if args.output_path:
        project_dir = Path(args.output_path).resolve()
    else:
        if not args.project_name:
            parser.error("--project-name is required when --output-path is not provided.")
        project_dir = build_project_path(Path(args.root).resolve(), args.project_name)

    folders = (
        "原图",
        "参考",
        "输出",
        "输出/提示词",
        "输出/确认图",
        "输出/成品",
        "输出/运行记录",
        "输出/临时",
    )
    for folder_name in folders:
        (project_dir / folder_name).mkdir(parents=True, exist_ok=True)

    print(project_dir)
    for folder_name in folders:
        print(project_dir / folder_name)


if __name__ == "__main__":
    main()
