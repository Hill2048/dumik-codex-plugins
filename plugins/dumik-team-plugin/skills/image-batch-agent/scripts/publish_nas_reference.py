#!/usr/bin/env python3
"""Publish local image files to a NAS folder and print public URLs for Banana2."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import shutil
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

import requests


DEFAULT_NAS_ROOT = r"Z:\文件临时传送\banana2_refs"
CONFIG_NAME = "nas_image_url.json"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


class NasPublishError(Exception):
    pass


@dataclass
class PublishResult:
    source: str
    nas_path: str
    url: str
    verified: bool
    status_code: int | None
    content_type: str


def codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME") or r"C:\Users\admin\.codex")


def config_path() -> Path:
    return codex_home() / "dumik-team-plugin" / CONFIG_NAME


def load_config() -> dict[str, str]:
    path = config_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise NasPublishError(f"NAS config JSON is invalid: {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise NasPublishError(f"NAS config must be an object: {path}")
    return {str(key): str(value) for key, value in data.items() if value is not None}


def save_config(nas_root: str, public_base_url: str) -> None:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "nas_root": nas_root,
        "public_base_url": public_base_url.rstrip("/"),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_settings(args: argparse.Namespace) -> tuple[Path, str]:
    config = load_config()
    nas_root = (
        args.nas_root
        or os.environ.get("DUMIK_NAS_IMAGE_ROOT")
        or config.get("nas_root")
        or DEFAULT_NAS_ROOT
    )
    public_base_url = (
        args.public_base_url
        or os.environ.get("DUMIK_NAS_IMAGE_PUBLIC_BASE_URL")
        or config.get("public_base_url")
        or ""
    ).strip()
    if not public_base_url:
        raise NasPublishError(
            "Missing public base URL. Pass --public-base-url or save it with --save-config."
        )
    if not public_base_url.startswith(("http://", "https://")):
        raise NasPublishError("Public base URL must start with http:// or https://.")
    return Path(nas_root), public_base_url.rstrip("/")


def safe_name(path: Path) -> str:
    stem = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "-", path.stem).strip(".-")
    if not stem:
        stem = "image"
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")[:-3]
    token = uuid.uuid4().hex[:6]
    return f"{stem}-{stamp}-{token}{path.suffix.lower()}"


def url_join(base: str, parts: list[str]) -> str:
    encoded_parts = [quote(part.replace("\\", "/").strip("/"), safe="/") for part in parts if part]
    return "/".join([base.rstrip("/"), *encoded_parts])


def verify_url(url: str) -> tuple[bool, int | None, str]:
    headers = {"User-Agent": "dumik-banana2-nas-url-check/1.0"}
    try:
        response = requests.head(url, headers=headers, timeout=20, allow_redirects=True)
        if response.status_code in {405, 403} or not response.headers.get("Content-Type"):
            response = requests.get(url, headers=headers, timeout=30, stream=True, allow_redirects=True)
        content_type = response.headers.get("Content-Type", "")
        ok_status = 200 <= response.status_code < 300
        ok_type = content_type.lower().startswith("image/")
        return ok_status and ok_type, response.status_code, content_type
    except requests.RequestException:
        return False, None, ""


def publish_one(source: Path, nas_root: Path, public_base_url: str, subdir: str, verify: bool) -> PublishResult:
    if not source.exists():
        raise NasPublishError(f"Source image not found: {source}")
    if not source.is_file():
        raise NasPublishError(f"Source is not a file: {source}")
    if source.suffix.lower() not in IMAGE_EXTENSIONS:
        raise NasPublishError(f"Unsupported image extension: {source.suffix}")

    target_dir = nas_root / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / safe_name(source)
    shutil.copy2(source, target_path)

    mime = mimetypes.guess_type(target_path.name)[0] or ""
    url = url_join(public_base_url, [subdir, target_path.name])
    verified = False
    status_code = None
    content_type = mime
    if verify:
        verified, status_code, content_type = verify_url(url)
    return PublishResult(
        source=str(source),
        nas_path=str(target_path),
        url=url,
        verified=verified,
        status_code=status_code,
        content_type=content_type,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy image files to a NAS public folder and output Banana2 reference URLs."
    )
    parser.add_argument("images", nargs="+", help="Local image files to publish.")
    parser.add_argument("--nas-root", help=f"NAS folder mapped by the public URL. Default: {DEFAULT_NAS_ROOT}")
    parser.add_argument("--public-base-url", help="Public URL prefix that maps to --nas-root.")
    parser.add_argument("--subdir", default=datetime.now().strftime("%Y%m%d"), help="Subfolder under NAS root.")
    parser.add_argument("--save-config", action="store_true", help="Save NAS root and public base URL for future runs.")
    parser.add_argument("--no-verify", action="store_true", help="Skip public URL validation.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        nas_root, public_base_url = resolve_settings(args)
        if args.save_config:
            save_config(str(nas_root), public_base_url)
        results = [
            publish_one(Path(image), nas_root, public_base_url, args.subdir, not args.no_verify)
            for image in args.images
        ]
    except NasPublishError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    payload = [result.__dict__ for result in results]
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    for result in results:
        state = "OK" if result.verified else "UNVERIFIED"
        if args.no_verify:
            state = "SKIPPED"
        print(f"{state}\t{result.url}\t{result.nas_path}")


if __name__ == "__main__":
    main()
