#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ast
import base64
import json
import mimetypes
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib import error, request


DEFAULT_OUTPUT_DIR = Path.cwd() / "输出"
DEFAULT_PROVIDER = "dreamina"
DEFAULT_MODEL = "seedance2.0fast_vip"
DEFAULT_RESOLUTION = "720p"
DEFAULT_RATIO = "3:4"
DEFAULT_DURATION = 5
DEFAULT_MODE = "multimodal2video"
DEFAULT_POLL = 20
DEFAULT_MAX_WAIT = 1800
DEFAULT_VEO_BASE_URL = "https://apibusiness.bafang.me"
DEFAULT_VEO_MODEL = "gemini-veo-3.1-fast-generate-preview-4s"
ALLOWED_RATIOS = {"16:9", "3:4", "9:16"}
VEO_RATIOS = {"16:9", "9:16"}
VEO_DURATIONS = {4, 6, 8}
VEO_MODELS = {
    "gemini-veo-3.1-fast-generate-preview-4s",
    "gemini-veo-3.1-fast-generate-preview-6s",
    "gemini-veo-3.1-fast-generate-preview-8s",
    "gemini-veo-3.1-generate-preview-4s",
    "gemini-veo-3.1-generate-preview-6s",
    "gemini-veo-3.1-generate-preview-8s",
    "gemini-veo-3.1-generate-preview-ref-4s",
    "gemini-veo-3.1-generate-preview-ref-6s",
    "gemini-veo-3.1-generate-preview-ref-8s",
}
VEO_FAMILIES = {
    "veo": "gemini-veo-3.1-fast-generate-preview-{seconds}s",
    "veo-fast": "gemini-veo-3.1-fast-generate-preview-{seconds}s",
    "veo-standard": "gemini-veo-3.1-generate-preview-{seconds}s",
    "veo-ref": "gemini-veo-3.1-generate-preview-ref-{seconds}s",
}
VEO_SIZES = {
    ("16:9", "720p"): "1280x720",
    ("9:16", "720p"): "720x1280",
    ("16:9", "1080p"): "1920x1080",
    ("9:16", "1080p"): "1080x1920",
}
VEO_ALLOWED_SIZES = {"1280x720", "720x1280", "1920x1080", "1080x1920"}
VEO_TERMINAL_STATUS = {"completed", "failed"}


class BatchVideoError(Exception):
    pass


@dataclass
class VideoPromptItem:
    id: str
    provider: str
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
    images: list[str]
    size: str | None
    generate_audio: bool | None
    negative_prompt: str | None
    final_instruction: str


def normalize_provider(value: str | None, mode: str | None, model_version: str | None) -> str:
    raw = (value or "").strip().lower()
    mode_raw = (mode or "").strip().lower()
    model_raw = (model_version or "").strip().lower()
    if raw in {"veo", "newapi-veo", "google-veo"} or mode_raw.startswith("veo") or model_raw.startswith("gemini-veo"):
        return "veo"
    if raw in {"", "dreamina", "jimeng", "seedance", "即梦"}:
        return "dreamina"
    raise BatchVideoError(f"Unsupported provider: {value}. Use dreamina or veo.")


def parse_optional_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "y"}:
            return True
        if lowered in {"false", "0", "no", "n"}:
            return False
    raise BatchVideoError(f"Invalid boolean value: {value}")


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

        mode = str(row.get("mode") or DEFAULT_MODE).strip()
        model_version = str(row.get("model_version") or row.get("model") or DEFAULT_MODEL).strip()
        provider = normalize_provider(row.get("provider"), mode, model_version)

        count = int(row.get("count") or 1)
        if count < 1 or count > 4:
            raise BatchVideoError(f"Results item {item_id} count must be between 1 and 4.")

        default_ratio = "16:9" if provider == "veo" else DEFAULT_RATIO
        ratio = str(row.get("ratio") or default_ratio).strip()
        if ratio not in ALLOWED_RATIOS:
            raise BatchVideoError(
                f"Results item {item_id} ratio must be one of: {', '.join(sorted(ALLOWED_RATIOS))}."
            )

        duration = row.get("duration")
        if duration is None:
            duration = 4 if provider == "veo" else DEFAULT_DURATION

        images = []
        for key in ("images", "image_urls"):
            values = row.get(key) or []
            if isinstance(values, str):
                values = [values]
            if not isinstance(values, list):
                raise BatchVideoError(f"Results item {item_id} field '{key}' must be a string or array.")
            images.extend(str(x).strip() for x in values if str(x).strip())
        for key in ("image_url", "image", "input_reference"):
            if row.get(key):
                images.append(str(row[key]).strip())

        items.append(
            VideoPromptItem(
                id=item_id,
                provider=provider,
                file=str(row.get("file")).strip() if row.get("file") else None,
                task=str(row.get("task") or "").strip(),
                count=count,
                output_name=str(row.get("output_name") or item_id).strip(),
                ratio=ratio,
                duration=int(duration),
                mode=mode,
                model_version=model_version,
                video_resolution=str(row.get("video_resolution") or DEFAULT_RESOLUTION).strip(),
                reference_images=[str(x).strip() for x in (row.get("reference_images") or []) if str(x).strip()],
                reference_videos=[str(x).strip() for x in (row.get("reference_videos") or []) if str(x).strip()],
                reference_audios=[str(x).strip() for x in (row.get("reference_audios") or []) if str(x).strip()],
                images=images,
                size=str(row.get("size")).strip() if row.get("size") else None,
                generate_audio=parse_optional_bool(row.get("generate_audio")),
                negative_prompt=str(row.get("negative_prompt")).strip() if row.get("negative_prompt") else None,
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


def codex_home() -> Path:
    return Path(os.getenv("CODEX_HOME") or (Path.home() / ".codex"))


def read_local_api_cache() -> tuple[str, str]:
    cache_path = codex_home() / "dumik-team-plugin" / "api_settings.py"
    if not cache_path.exists():
        return "", ""
    text = cache_path.read_text(encoding="utf-8", errors="ignore")

    def read_constant(*names: str) -> str:
        for name in names:
            match = re.search(rf"^{name}\s*=\s*(.+)$", text, re.MULTILINE)
            if not match:
                continue
            try:
                value = ast.literal_eval(match.group(1).strip())
            except (SyntaxError, ValueError):
                continue
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    base_url = read_constant("NEW_API_BUSINESS_BASE", "BUSINESS_BASE_URL", "VEO_BASE_URL", "API_BASE_URL")
    api_key = read_constant("NEW_API_TOKEN", "API_KEY")
    return base_url, api_key


def clean_config_value(value: str) -> str:
    value = value.strip().strip(",")
    if len(value) >= 2 and value[0] == value[-1] == '"':
        return value[1:-1]
    return value


def read_codex_model_provider() -> dict[str, str]:
    config_path = codex_home() / "config.toml"
    if not config_path.exists():
        return {}

    current_provider: str | None = None
    default_provider: str | None = None
    providers: dict[str, dict[str, str]] = {}

    for raw_line in config_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue

        section_match = re.match(r'^\[model_providers\.([^\]]+)\]$', line)
        if section_match:
            current_provider = section_match.group(1)
            providers.setdefault(current_provider, {})
            continue
        if line.startswith("["):
            current_provider = None
            continue

        if "=" not in line:
            continue
        key, value = [part.strip() for part in line.split("=", 1)]
        value = clean_config_value(value)

        if current_provider:
            if key in {"base_url", "experimental_bearer_token", "api_key"}:
                providers[current_provider][key] = value
        elif key == "model_provider":
            default_provider = value

    candidates: list[dict[str, str]] = []
    candidates.extend(
        provider for provider in providers.values() if "apibusiness" in provider.get("base_url", "")
    )
    candidates.extend(
        provider for provider in providers.values() if "juaihub.cn" in provider.get("base_url", "")
    )
    if default_provider and default_provider in providers:
        candidates.append(providers[default_provider])
    candidates.extend(providers.values())

    for provider in candidates:
        base_url = provider.get("base_url", "").strip()
        token = (
            provider.get("experimental_bearer_token", "").strip()
            or provider.get("api_key", "").strip()
        )
        if base_url or token:
            return {"base_url": base_url, "api_key": token}
    return {}


def find_json_value(value: Any, keys: set[str]) -> str:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in keys and isinstance(item, str) and item.strip():
                return item.strip()
        for item in value.values():
            found = find_json_value(item, keys)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = find_json_value(item, keys)
            if found:
                return found
    return ""


def read_codex_auth_api_key() -> str:
    auth_path = codex_home() / "auth.json"
    if not auth_path.exists():
        return ""
    try:
        auth = json.loads(auth_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ""
    return find_json_value(auth, {"NEW_API_TOKEN", "JUAIHUB_API_KEY", "OPENAI_API_KEY", "api_key"})


def normalize_business_base_url(base_url: str) -> str:
    clean = base_url.rstrip("/")
    if clean.endswith("/v1"):
        return clean[:-3]
    return clean


def resolve_veo_api_settings(args: argparse.Namespace) -> tuple[str, str]:
    cache_base_url, cache_api_key = read_local_api_cache()
    provider = read_codex_model_provider()
    provider_base_url = provider.get("base_url", "")
    base_url = (
        args.base_url
        or (cache_base_url if "apibusiness" in cache_base_url else "")
        or (provider_base_url if "apibusiness" in provider_base_url else "")
        or os.getenv("NEW_API_BUSINESS_BASE")
        or os.getenv("VEO_BASE_URL")
        or DEFAULT_VEO_BASE_URL
    )
    api_key = (
        args.api_key
        or cache_api_key
        or provider.get("api_key")
        or read_codex_auth_api_key()
        or os.getenv("NEW_API_TOKEN")
        or os.getenv("JUAIHUB_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )
    if not api_key:
        raise BatchVideoError(
            "Missing Veo API key. Run scripts/init_api_cache.py, pass --api-key, "
            "configure CODEX_HOME/config.toml or auth.json, or set NEW_API_TOKEN/JUAIHUB_API_KEY."
        )
    return normalize_business_base_url(base_url), api_key


def image_to_data_url(value: str) -> str:
    if value.startswith(("http://", "https://", "data:image/")):
        return value
    path = Path(value)
    if not path.exists():
        raise BatchVideoError(f"Veo reference image not found: {path}")
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def veo_size_for_item(item: VideoPromptItem) -> str:
    if item.size:
        normalized = item.size.lower().replace("×", "x").strip()
        if normalized not in VEO_ALLOWED_SIZES:
            raise BatchVideoError(
                f"Veo size for {item.id} must be one of: {', '.join(sorted(VEO_ALLOWED_SIZES))}."
            )
        return normalized
    resolution = (item.video_resolution or "720p").lower()
    if resolution not in {"720p", "1080p"}:
        raise BatchVideoError(f"Veo video_resolution for {item.id} must be 720p or 1080p.")
    ratio = item.ratio or "16:9"
    if ratio not in VEO_RATIOS:
        raise BatchVideoError(f"Veo ratio for {item.id} must be 16:9 or 9:16.")
    return VEO_SIZES[(ratio, resolution)]


def resolve_veo_model(item: VideoPromptItem) -> str:
    if item.model_version and item.model_version in VEO_MODELS:
        return item.model_version
    duration = int(item.duration or 4)
    if duration not in VEO_DURATIONS:
        raise BatchVideoError(f"Veo duration for {item.id} must be 4, 6, or 8 seconds.")
    mode = (item.mode or "veo-fast").strip().lower()
    family = VEO_FAMILIES.get(mode, VEO_FAMILIES["veo-fast"])
    return family.format(seconds=duration)


def collect_veo_images(item: VideoPromptItem, model: str) -> list[str]:
    if item.reference_videos or item.reference_audios:
        raise BatchVideoError(f"Veo does not accept video/audio references for {item.id}; use images only.")
    raw_images: list[str] = []
    if item.file:
        raw_images.append(item.file)
    raw_images.extend(item.reference_images)
    raw_images.extend(item.images)
    images = [image_to_data_url(value) for value in raw_images]
    limit = 3 if "-ref-" in model else 2
    if len(images) > limit:
        raise BatchVideoError(f"Veo model {model} accepts at most {limit} reference images for {item.id}.")
    return images


def request_json(url: str, *, api_key: str, method: str = "GET", payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    req = request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with request.urlopen(req, timeout=120) as response:
            body = response.read().decode("utf-8", errors="replace")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise BatchVideoError(f"Veo API request failed ({exc.code}): {body[:1200]}") from exc
    except error.URLError as exc:
        raise BatchVideoError(f"Veo API request failed: {exc.reason}") from exc
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise BatchVideoError(f"Veo API returned non-JSON response: {body[:1200]}") from exc


def download_veo_content(url: str, *, api_key: str, output_path: Path) -> str:
    req = request.Request(url, headers={"Authorization": f"Bearer {api_key}", "Accept": "*/*"})
    try:
        with request.urlopen(req, timeout=900) as response:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(response.read())
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise BatchVideoError(f"Veo video download failed ({exc.code}): {body[:1200]}") from exc
    except error.URLError as exc:
        raise BatchVideoError(f"Veo video download failed: {exc.reason}") from exc
    return str(output_path.resolve())


def run_veo_submit(
    item: VideoPromptItem,
    output_dir: Path,
    base_url: str,
    api_key: str,
    poll: int,
    max_wait: int,
) -> dict[str, Any]:
    item_dir = output_dir / Path(item.output_name).stem
    item_dir.mkdir(parents=True, exist_ok=True)
    model = resolve_veo_model(item)
    size = veo_size_for_item(item)
    images = collect_veo_images(item, model)
    payload: dict[str, Any] = {
        "model": model,
        "prompt": item.final_instruction,
        "size": size,
    }
    if item.generate_audio is not None:
        payload["generate_audio"] = item.generate_audio
    if item.negative_prompt:
        payload["negative_prompt"] = item.negative_prompt
    if len(images) == 1:
        payload["image_url"] = images[0]
    elif len(images) > 1:
        payload["images"] = images

    submit_result = request_json(f"{base_url}/v1/videos", api_key=api_key, method="POST", payload=payload)
    task_id = submit_result.get("task_id") or submit_result.get("id")
    if not task_id:
        raise BatchVideoError(f"Veo submit response missing task_id for {item.id}.")

    status_result = submit_result
    started = time.monotonic()
    while str(status_result.get("status", "")).lower() not in VEO_TERMINAL_STATUS:
        if time.monotonic() - started >= max_wait:
            break
        time.sleep(max(5, poll))
        status_result = request_json(f"{base_url}/v1/videos/{task_id}", api_key=api_key)

    downloaded: list[str] = []
    if str(status_result.get("status", "")).lower() == "completed":
        output_name = Path(item.output_name).stem + ".mp4"
        downloaded.append(
            download_veo_content(
                f"{base_url}/v1/videos/{task_id}/content",
                api_key=api_key,
                output_path=item_dir / output_name,
            )
        )

    return {
        "id": item.id,
        "provider": "veo",
        "output_dir": str(item_dir.resolve()),
        "task_id": task_id,
        "model": model,
        "size": size,
        "status": status_result.get("status"),
        "progress": status_result.get("progress"),
        "submit_result": submit_result,
        "query_result": status_result,
        "downloaded_files": downloaded,
        "submitted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


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
        "provider": "dreamina",
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
                f"- 服务: {row.get('provider') or 'dreamina'}",
                f"- 提交 ID: {row.get('submit_id') or '未生成'}",
                f"- Veo 任务 ID: {row.get('task_id') or '未生成'}",
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
    parser = argparse.ArgumentParser(description="Generate Dreamina or Veo videos in batch from finished prompts.")
    parser.add_argument("--results-input", required=True, help="JSON file with finished prompts.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Where to store downloads and logs.")
    parser.add_argument("--poll", type=int, default=DEFAULT_POLL, help="Seconds to wait briefly after submit.")
    parser.add_argument("--max-wait", type=int, default=DEFAULT_MAX_WAIT, help="Max seconds to wait for Veo completion.")
    parser.add_argument("--provider", choices=["dreamina", "veo"], help="Override provider for all rows.")
    parser.add_argument("--base-url", help="Veo business API base URL. Overrides local Codex cache.")
    parser.add_argument("--api-key", help="Veo API key. Overrides local Codex cache.")
    args = parser.parse_args()

    input_path = Path(args.results_input).resolve()
    output_dir = Path(args.output_dir).resolve()
    items = load_prompt_items(input_path)
    if args.provider:
        items = [VideoPromptItem(**{**asdict(item), "provider": args.provider}) for item in items]
    veo_settings: tuple[str, str] | None = None
    if any(item.provider == "veo" for item in items):
        veo_settings = resolve_veo_api_settings(args)

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
            if current.provider == "veo":
                if not veo_settings:
                    raise BatchVideoError("Veo API settings were not initialized.")
                result = run_veo_submit(
                    current,
                    output_dir,
                    base_url=veo_settings[0],
                    api_key=veo_settings[1],
                    poll=args.poll,
                    max_wait=args.max_wait,
                )
            else:
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
