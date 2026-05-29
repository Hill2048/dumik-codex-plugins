#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pillow>=10.0.0",
#   "requests>=2.28.1",
# ]
# ///
"""
Generate one image by default, or run an explicit batch from finished prompt rows.
"""

from __future__ import annotations

import argparse
import ast
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import mimetypes
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from PIL import Image


DEFAULT_OUTPUT_DIR = Path.cwd() / "输出"
DEFAULT_BASE_URL = "https://api.juaihub.cn"
DEFAULT_IMAGE_MODEL = "gpt-image-2"
BANANA2_IMAGE_MODEL = "gemini-3.1-flash-image"
CHAT_IMAGE_MODELS = {"gemini-3.1-flash-image", "gemini-3.1-flash-image-preview"}
IMAGE_MODEL_ALIASES = {
    "gpt-image-2": "gpt-image-2",
    "banana2": BANANA2_IMAGE_MODEL,
    "gemini-3.1-flash-image": "gemini-3.1-flash-image",
    "gemini-3.1-flash-image-preview": "gemini-3.1-flash-image-preview",
}
DEFAULT_STORYBOARD_RATIO = "9:16"
DEFAULT_STORYBOARD_SIZES = {
    "16:9": (3840, 2160),
    "3:4": (2880, 3840),
    "9:16": (2160, 3840),
}
DEFAULT_BATCH_LONG_EDGE = 2048
DEFAULT_CONCURRENCY = 3
IMAGE2_MIN_PIXELS = 655_360
IMAGE2_MAX_PIXELS = 8_294_400
IMAGE2_MAX_EDGE = 4000
IMAGE2_MAX_RATIO = 3.0
IMAGE2_2K_PIXELS = 2_359_296


class BatchImageError(Exception):
    pass


def codex_home() -> Path:
    return Path(os.getenv("CODEX_HOME") or (Path.home() / ".codex"))


def read_local_api_cache() -> tuple[str, str]:
    cache_path = codex_home() / "dumik-team-plugin" / "api_settings.py"
    if not cache_path.exists():
        return "", ""
    text = cache_path.read_text(encoding="utf-8", errors="ignore")

    def read_constant(name: str) -> str:
        match = re.search(rf"^{name}\s*=\s*(.+)$", text, re.MULTILINE)
        if not match:
            return ""
        try:
            value = ast.literal_eval(match.group(1).strip())
        except (SyntaxError, ValueError):
            return ""
        return value.strip() if isinstance(value, str) else ""

    return read_constant("API_BASE_URL"), read_constant("API_KEY")


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
    return find_json_value(auth, {"JUAIHUB_API_KEY", "OPENAI_API_KEY", "api_key"})


def codex_api_defaults() -> tuple[str, str]:
    cache_base_url, cache_api_key = read_local_api_cache()
    if cache_base_url and cache_api_key:
        return cache_base_url, cache_api_key

    provider = read_codex_model_provider()
    base_url = cache_base_url or provider.get("base_url", "")
    api_key = cache_api_key or provider.get("api_key", "") or read_codex_auth_api_key()
    return base_url, api_key


def image_api_endpoint(base_url: str, endpoint: str) -> str:
    clean = base_url.rstrip("/")
    if clean.endswith("/v1"):
        return clean + endpoint
    return clean + "/v1" + endpoint


@dataclass
class PromptItem:
    id: str
    file: str | None
    reference_files: list[str]
    task: str
    count: int
    output_name: str
    final_instruction: str
    output_size: str | None


def die(message: str, code: int = 1) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(code)


def normalize_image_model(value: str) -> str:
    key = (value or DEFAULT_IMAGE_MODEL).strip().lower()
    model = IMAGE_MODEL_ALIASES.get(key)
    if not model:
        choices = ", ".join(IMAGE_MODEL_ALIASES)
        raise BatchImageError(f"Unsupported image model: {value}. Use one of: {choices}.")
    return model


def read_prompt(prompt: str | None, prompt_file: str | None) -> str:
    if prompt and prompt_file:
        raise BatchImageError("Use --prompt or --prompt-file, not both.")
    if prompt_file:
        path = Path(prompt_file)
        if not path.exists():
            raise BatchImageError(f"Prompt file not found: {path}")
        return path.read_text(encoding="utf-8").strip()
    if prompt:
        return prompt.strip()
    raise BatchImageError("Single-image mode requires --prompt or --prompt-file.")


def output_dir_and_name(output_dir: str, out: str | None) -> tuple[Path, str]:
    if out:
        out_path = Path(out).resolve()
        if out_path.suffix:
            return out_path.parent, out_path.name
        return out_path, "output.png"
    return Path(output_dir).resolve(), "output.png"


def single_prompt_item(args: argparse.Namespace) -> tuple[PromptItem, Path]:
    prompt = read_prompt(args.prompt, args.prompt_file)
    output_dir, output_name = output_dir_and_name(args.output_dir, args.out)
    source_file = str(Path(args.image).resolve()) if args.image else None
    reference_files = [str(Path(path).resolve()) for path in (args.reference or [])]
    count = int(args.count or 1)
    if count < 1 or count > 8:
        raise BatchImageError("--count must be between 1 and 8.")
    return (
        PromptItem(
            id=args.id or "single-001",
            file=source_file,
            reference_files=reference_files,
            task=args.task or "",
            count=count,
            output_name=output_name,
            final_instruction=prompt,
            output_size=args.output_size,
        ),
        output_dir,
    )


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
                reference_files=[
                    str(path).strip()
                    for path in row.get("reference_files", [])
                    if str(path).strip()
                ]
                if isinstance(row.get("reference_files"), list)
                else [],
                task=str(row.get("task") or "").strip(),
                count=count,
                output_name=str(row.get("output_name") or f"{item_id}.png").strip(),
                final_instruction=final_instruction,
                output_size=str(row.get("output_size")).strip() if row.get("output_size") else None,
            )
        )
    return items


def is_storyboard_item(item: PromptItem) -> bool:
    text = " ".join(
        [
            item.id,
            item.task,
            item.output_name,
            item.final_instruction,
        ]
    ).lower()
    return "故事板" in text or "storyboard" in text


def parse_output_size(value: str | None) -> tuple[int, int] | None:
    if not value:
        return None
    normalized = value.lower().replace("×", "x").strip()
    presets = {
        "4k": DEFAULT_STORYBOARD_SIZES[DEFAULT_STORYBOARD_RATIO],
        "storyboard-4k": DEFAULT_STORYBOARD_SIZES[DEFAULT_STORYBOARD_RATIO],
        "16:9-storyboard": DEFAULT_STORYBOARD_SIZES["16:9"],
        "storyboard-16:9": DEFAULT_STORYBOARD_SIZES["16:9"],
        "3:4-storyboard": DEFAULT_STORYBOARD_SIZES["9:16"],
        "storyboard-3:4": DEFAULT_STORYBOARD_SIZES["9:16"],
        "3:4-panel-storyboard": DEFAULT_STORYBOARD_SIZES["9:16"],
        "storyboard-3:4-panel": DEFAULT_STORYBOARD_SIZES["9:16"],
        "9:16-storyboard": DEFAULT_STORYBOARD_SIZES["9:16"],
        "storyboard-9:16": DEFAULT_STORYBOARD_SIZES["9:16"],
        "2k": (DEFAULT_BATCH_LONG_EDGE, DEFAULT_BATCH_LONG_EDGE),
    }
    if normalized in presets:
        return presets[normalized]
    if "x" not in normalized:
        raise BatchImageError(f"Unsupported output_size: {value}")
    width_raw, height_raw = normalized.split("x", 1)
    width = int(width_raw)
    height = int(height_raw)
    if width < 1 or height < 1:
        raise BatchImageError(f"output_size must be positive: {value}")
    validate_image2_size(width, height, source=value)
    return width, height


def validate_image2_size(width: int, height: int, *, source: str) -> None:
    if width % 16 != 0 or height % 16 != 0:
        raise BatchImageError(f"Image2 size must use multiples of 16: {source}")
    if width > IMAGE2_MAX_EDGE or height > IMAGE2_MAX_EDGE:
        raise BatchImageError(f"Image2 size edge must be <= 4000: {source}")
    ratio = max(width / height, height / width)
    if ratio > IMAGE2_MAX_RATIO:
        raise BatchImageError(f"Image2 aspect ratio must stay within 1:3 to 3:1: {source}")
    pixels = width * height
    if pixels < IMAGE2_MIN_PIXELS or pixels > IMAGE2_MAX_PIXELS:
        raise BatchImageError(f"Image2 pixels must be 655360..8294400: {source}")


def target_size_for_item(item: PromptItem) -> tuple[int, int] | None:
    explicit = parse_output_size(item.output_size)
    if explicit:
        return explicit
    if is_storyboard_item(item):
        return DEFAULT_STORYBOARD_SIZES[DEFAULT_STORYBOARD_RATIO]
    return None


def api_size_for_item(item: PromptItem) -> str:
    target = target_size_for_item(item)
    if not target:
        return "1024x1024"
    width, height = target
    validate_image2_size(width, height, source=f"{width}x{height}")
    return f"{width}x{height}"


def image2_quality_for_size(size: str) -> str:
    match = re.fullmatch(r"(\d+)x(\d+)", size)
    if not match:
        return "medium"
    pixels = int(match.group(1)) * int(match.group(2))
    return "high" if pixels >= IMAGE2_2K_PIXELS else "medium"


def image_model_payload_options(image_model: str, size: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "size": size,
        "response_format": "b64_json",
    }
    if image_model == DEFAULT_IMAGE_MODEL:
        payload["quality"] = image2_quality_for_size(size)
    return payload


def aspect_ratio_for_size(size: str) -> str:
    match = re.fullmatch(r"(\d+)x(\d+)", size)
    if not match:
        return "1:1"
    width = int(match.group(1))
    height = int(match.group(2))
    ratio = width / height
    known = {
        "1:1": 1.0,
        "16:9": 16 / 9,
        "9:16": 9 / 16,
        "4:3": 4 / 3,
        "3:4": 3 / 4,
    }
    return min(known, key=lambda key: abs(known[key] - ratio))


def image_size_label(size: str) -> str:
    match = re.fullmatch(r"(\d+)x(\d+)", size)
    if not match:
        return "1K"
    return "4K" if max(int(match.group(1)), int(match.group(2))) >= 2000 else "1K"


def image_path_to_data_url(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def image_path_to_inline_data(path: Path) -> dict[str, str]:
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return {"mimeType": mime, "data": encoded}


def collect_chat_images(value: Any) -> dict[str, list[str]]:
    found = {"b64_json": [], "url": []}
    if isinstance(value, str):
        for match in re.finditer(r"data:image/[A-Za-z0-9.+-]+;base64,([A-Za-z0-9+/=\r\n]+)", value):
            found["b64_json"].append(re.sub(r"\s+", "", match.group(1)))
        for match in re.finditer(r"https?://[^\s)\"']+", value):
            found["url"].append(match.group(0))
    elif isinstance(value, dict):
        if isinstance(value.get("b64_json"), str):
            found["b64_json"].append(value["b64_json"])
        inline_data = value.get("inlineData") or value.get("inline_data")
        if isinstance(inline_data, dict) and isinstance(inline_data.get("data"), str):
            found["b64_json"].append(inline_data["data"])
        image_url = value.get("image_url")
        if isinstance(image_url, dict) and isinstance(image_url.get("url"), str):
            url = image_url["url"]
            if url.startswith("data:image/"):
                found["b64_json"].extend(collect_chat_images(url)["b64_json"])
            else:
                found["url"].append(url)
        if isinstance(value.get("url"), str):
            url = value["url"]
            if url.startswith("data:image/"):
                found["b64_json"].extend(collect_chat_images(url)["b64_json"])
            else:
                found["url"].append(url)
        for item in value.values():
            nested = collect_chat_images(item)
            found["b64_json"].extend(nested["b64_json"])
            found["url"].extend(nested["url"])
    elif isinstance(value, list):
        for item in value:
            nested = collect_chat_images(item)
            found["b64_json"].extend(nested["b64_json"])
            found["url"].extend(nested["url"])
    return found


def save_chat_response_images(body: dict[str, Any], output_paths: list[Path]) -> list[str]:
    images = collect_chat_images(body)
    if images["b64_json"]:
        return save_b64_images(images["b64_json"], output_paths)
    if images["url"]:
        return save_url_images(images["url"], output_paths)
    snippet = json.dumps(body, ensure_ascii=False)[:1200]
    raise BatchImageError(f"Chat image API returned no image data: {snippet}")


def generate_chat_images(
    *,
    base_url: str,
    api_key: str,
    image_model: str,
    source_file: str | None,
    reference_files: list[str],
    prompt: str,
    count: int,
    size: str,
    output_paths: list[Path],
) -> list[str]:
    image_inputs = [source_file] if source_file else []
    image_inputs.extend(reference_files)
    parts: list[dict[str, Any]] = [{"text": prompt}]
    if image_inputs:
        for raw_path in image_inputs:
            image_path = Path(raw_path)
            if not image_path.exists():
                raise BatchImageError(f"Source image not found: {image_path}")
            parts.append({"inlineData": image_path_to_inline_data(image_path)})

    encoded_images: list[str] = []
    downloaded_urls: list[str] = []
    root_url = base_url.split("/v1", 1)[0].rstrip("/")
    url = f"{root_url}/v1beta/models/{image_model}:generateContent"
    for _ in range(count):
        response = requests.post(
            url,
            params={"key": api_key},
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "responseModalities": ["TEXT", "IMAGE"],
                    "imageConfig": {
                        "aspectRatio": aspect_ratio_for_size(size),
                        "imageSize": image_size_label(size),
                    }
                },
            },
            timeout=900,
        )
        if response.status_code >= 400:
            raise BatchImageError(
                f"Gemini image API request failed ({response.status_code}): {response.text[:1200]}"
            )
        images = collect_chat_images(response.json())
        encoded_images.extend(images["b64_json"])
        downloaded_urls.extend(images["url"])

    if encoded_images:
        return save_b64_images(encoded_images, output_paths)
    if downloaded_urls:
        return save_url_images(downloaded_urls, output_paths)
    raise BatchImageError("Gemini image API returned no image data.")


def standardize_image_size(path: Path, item: PromptItem) -> str:
    with Image.open(path) as image:
        target = target_size_for_item(item)
        if target:
            if image.size != target:
                raise BatchImageError(
                    f"Generated image size {image.size[0]}x{image.size[1]} does not match requested "
                    f"{target[0]}x{target[1]}; refusing to stretch storyboard output."
                )
            return f"{image.size[0]}x{image.size[1]}"

        image = image.convert("RGB") if path.suffix.lower() in {".jpg", ".jpeg"} else image
        width, height = image.size
        long_edge = max(width, height)
        if long_edge != DEFAULT_BATCH_LONG_EDGE:
            scale = DEFAULT_BATCH_LONG_EDGE / long_edge
            target = (round(width * scale), round(height * scale))
            image = image.resize(target, Image.Resampling.LANCZOS)
            image.save(path)
            return f"{target[0]}x{target[1]}"
        return f"{width}x{height}"


def standardize_saved_images(paths: list[str], item: PromptItem) -> tuple[list[str], list[str]]:
    sizes: list[str] = []
    for raw_path in paths:
        sizes.append(standardize_image_size(Path(raw_path), item))
    return paths, sizes


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
    reference_files: list[str],
    prompt: str,
    count: int,
    size: str,
    output_paths: list[Path],
) -> list[str]:
    headers = {"Authorization": f"Bearer {api_key}"}
    image_model = normalize_image_model(image_model)
    if image_model in CHAT_IMAGE_MODELS:
        return generate_chat_images(
            base_url=base_url,
            api_key=api_key,
            image_model=image_model,
            source_file=source_file,
            reference_files=reference_files,
            prompt=prompt,
            count=count,
            size=size,
            output_paths=output_paths,
        )
    model_options = image_model_payload_options(image_model, size)
    image_inputs = [source_file] if source_file else []
    image_inputs.extend(reference_files)
    last_error = ""
    for attempt in range(1, 3):
        if image_inputs:
            image_paths = [Path(raw) for raw in image_inputs]
            for image_path in image_paths:
                if not image_path.exists():
                    raise BatchImageError(f"Source image not found: {image_path}")

            url = image_api_endpoint(base_url, "/images/edits")
            image_files = []
            try:
                for image_path in image_paths:
                    image_files.append(image_path.open("rb"))
                files = [
                    ("image", (image_path.name, image_file))
                    for image_path, image_file in zip(image_paths, image_files)
                ]
                response = requests.post(
                    url,
                    headers=headers,
                    data={
                        "model": image_model,
                        "prompt": prompt,
                        "n": str(count),
                        **model_options,
                    },
                    files=files,
                    timeout=900,
                )
            finally:
                for image_file in image_files:
                    image_file.close()
        else:
            url = image_api_endpoint(base_url, "/images/generations")
            response = requests.post(
                url,
                headers=headers,
                json={
                    "model": image_model,
                    "prompt": prompt,
                    "n": count,
                    **model_options,
                },
                timeout=900,
            )
        if response.status_code < 500:
            break
        last_error = f"Image API request failed ({response.status_code}): {response.text[:1200]}"
        if attempt == 1:
            time.sleep(8)
    else:
        raise BatchImageError(last_error)
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
        if row.get("actual_output_sizes"):
            lines.extend([f"- 输出尺寸: {', '.join(row['actual_output_sizes'])}", ""])
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


def run_prompt_item(
    *,
    item: PromptItem,
    output_dir: Path,
    base_url: str,
    api_key: str,
    image_model: str,
) -> dict[str, Any]:
    try:
        images = generate_images(
            base_url=base_url,
            api_key=api_key,
            image_model=image_model,
            source_file=item.file,
            reference_files=item.reference_files,
            prompt=item.final_instruction,
            count=item.count,
            size=api_size_for_item(item),
            output_paths=build_output_paths(output_dir, item.output_name, item.count),
        )
        images, output_sizes = standardize_saved_images(images, item)
        return {
            "id": item.id,
            "file": item.file,
            "reference_files": item.reference_files,
            "task": item.task,
            "count": item.count,
            "output_name": item.output_name,
            "image_model": normalize_image_model(image_model),
            "output_size": item.output_size
            or (
                "4K storyboard 9:16 2160x3840, 3:4 panels"
                if is_storyboard_item(item)
                else "2K long edge 2048"
            ),
            "actual_output_sizes": output_sizes,
            "final_instruction": item.final_instruction,
            "generated_files": images,
        }
    except BatchImageError as exc:
        return {
            "id": item.id,
            "file": item.file,
            "reference_files": item.reference_files,
            "task": item.task,
            "count": item.count,
            "output_name": item.output_name,
            "image_model": normalize_image_model(image_model),
            "final_instruction": item.final_instruction,
            "error": str(exc),
            "generated_files": [],
        }


def resolve_api_settings(args: argparse.Namespace) -> tuple[str, str]:
    codex_base_url, codex_api_key = codex_api_defaults()
    base_url = (
        args.base_url
        or codex_base_url
        or os.getenv("JUAIHUB_BASE_URL")
        or os.getenv("OPENAI_BASE_URL")
        or DEFAULT_BASE_URL
    )
    api_key = (
        args.api_key
        or codex_api_key
        or os.getenv("JUAIHUB_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )
    if not api_key:
        die(
            "Missing API key. Run scripts/init_api_cache.py, pass --api-key, "
            "configure CODEX_HOME/config.toml or auth.json, or set JUAIHUB_API_KEY/OPENAI_API_KEY."
        )
    return base_url, api_key


def run_single(args: argparse.Namespace, base_url: str, api_key: str) -> None:
    try:
        item, output_dir = single_prompt_item(args)
    except BatchImageError as exc:
        die(str(exc))

    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Generating {item.id}...")
    row = run_prompt_item(
        item=item,
        output_dir=output_dir,
        base_url=base_url,
        api_key=api_key,
        image_model=args.image_model,
    )
    write_json(output_dir / "运行记录.json", [row])
    write_markdown(output_dir / "运行记录.md", [row])
    if row.get("error"):
        die(str(row["error"]))
    print(f"Done. Results written to: {output_dir}")


def run_batch(args: argparse.Namespace, base_url: str, api_key: str) -> None:
    if not args.results_input:
        die("Batch mode requires --results-input.")
    if args.concurrency < 1 or args.concurrency > 8:
        die("--concurrency must be between 1 and 8.")

    try:
        prompt_items = load_prompt_items(Path(args.results_input).resolve())
    except BatchImageError as exc:
        die(str(exc))

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    rows_by_id: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        future_to_item = {}
        for item in prompt_items:
            print(f"Generating {item.id}...")
            future = executor.submit(
                run_prompt_item,
                item=item,
                output_dir=output_dir,
                base_url=base_url,
                api_key=api_key,
                image_model=args.image_model,
            )
            future_to_item[future] = item

        for future in as_completed(future_to_item):
            item = future_to_item[future]
            try:
                rows_by_id[item.id] = future.result()
            except Exception as exc:
                rows_by_id[item.id] = {
                    "id": item.id,
                    "file": item.file,
                    "reference_files": item.reference_files,
                    "task": item.task,
                    "count": item.count,
                    "output_name": item.output_name,
                    "image_model": normalize_image_model(args.image_model),
                    "final_instruction": item.final_instruction,
                    "error": str(exc),
                    "generated_files": [],
                }
            print(f"Finished {item.id}.")

    rows = [rows_by_id[item.id] for item in prompt_items]

    write_json(output_dir / "运行记录.json", rows)
    write_markdown(output_dir / "运行记录.md", rows)
    print(f"Done. Results written to: {output_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate one image by default, or run an explicit batch from finished prompt rows."
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Enable batch mode. Without this flag the script runs single-image mode.",
    )
    parser.add_argument("--results-input", help="JSON file with final_instruction rows for batch mode.")
    parser.add_argument("--prompt", help="Prompt for single-image mode.")
    parser.add_argument("--prompt-file", help="Prompt file for single-image mode.")
    parser.add_argument("--image", help="Source image for single-image edit mode.")
    parser.add_argument("--reference", action="append", help="Reference image for single-image edit mode.")
    parser.add_argument("--task", help="Task label written to the run record.")
    parser.add_argument("--id", help="Run record id for single-image mode.")
    parser.add_argument("--out", help="Output file path for single-image mode.")
    parser.add_argument("--count", type=int, default=1, help="Number of images for single-image mode.")
    parser.add_argument("--output-size", help="Output size, for example 1024x1024, 2160x3840, 4K, or 2K.")
    parser.add_argument(
        "--base-url",
        help="OpenAI-compatible API base URL. Overrides local Codex cache.",
    )
    parser.add_argument(
        "--image-model",
        default=DEFAULT_IMAGE_MODEL,
        help="Image model name: gpt-image-2, banana2, or gemini-3.1-flash-image.",
    )
    parser.add_argument(
        "--api-key",
        help="API key. Overrides local Codex cache.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory for generated images and logs.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        help="Number of prompt rows to generate concurrently in batch mode.",
    )
    args = parser.parse_args()
    try:
        args.image_model = normalize_image_model(args.image_model)
    except BatchImageError as exc:
        die(str(exc))
    base_url, api_key = resolve_api_settings(args)
    if args.batch:
        run_batch(args, base_url, api_key)
    else:
        run_single(args, base_url, api_key)


if __name__ == "__main__":
    main()
