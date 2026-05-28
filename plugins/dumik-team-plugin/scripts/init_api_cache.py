#!/usr/bin/env python3
"""Initialize local DUMIK Team Plugin API cache from Codex config.

The generated file lives under CODEX_HOME and is intentionally not part of the
public plugin package content that gets edited in Git.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib import error, request


DEFAULT_BASE_URL = "https://api.juaihub.cn/v1"


def codex_home() -> Path:
    return Path(os.getenv("CODEX_HOME") or (Path.home() / ".codex"))


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


def normalize_base_url(base_url: str) -> str:
    clean = base_url.rstrip("/")
    if clean.endswith("/v1"):
        return clean
    return clean + "/v1"


def resolve_api_settings(args: argparse.Namespace) -> tuple[str, str, str]:
    provider = read_codex_model_provider()
    base_url = (
        args.base_url
        or provider.get("base_url")
        or os.getenv("JUAIHUB_BASE_URL")
        or os.getenv("OPENAI_BASE_URL")
        or DEFAULT_BASE_URL
    )
    api_key = (
        args.api_key
        or provider.get("api_key")
        or read_codex_auth_api_key()
        or os.getenv("JUAIHUB_API_KEY")
        or os.getenv("OPENAI_API_KEY")
    )
    source = "command args" if args.base_url or args.api_key else "Codex config/auth"
    return normalize_base_url(base_url), api_key or "", source


def check_api(base_url: str, api_key: str) -> None:
    req = request.Request(
        base_url.rstrip("/") + "/models",
        headers={"Authorization": f"Bearer {api_key}"},
        method="GET",
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            if response.status >= 400:
                raise RuntimeError(f"HTTP {response.status}")
    except error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}") from exc
    except error.URLError as exc:
        raise RuntimeError(str(exc.reason)) from exc


def write_cache(path: Path, base_url: str, api_key: str, source: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = "\n".join(
        [
            "# Auto-generated by DUMIK Team Plugin.",
            "# Local secret cache. Do not commit or share this file.",
            f"GENERATED_AT = {datetime.now().isoformat(timespec='seconds')!r}",
            f"SOURCE = {source!r}",
            f"API_BASE_URL = {base_url!r}",
            f"API_KEY = {api_key!r}",
            "",
        ]
    )
    path.write_text(payload, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialize local API cache for DUMIK Team Plugin.")
    parser.add_argument("--base-url", help="Override API base URL for this cache.")
    parser.add_argument("--api-key", help="Override API key for this cache.")
    parser.add_argument(
        "--out",
        default=str(codex_home() / "dumik-team-plugin" / "api_settings.py"),
        help="Generated local cache path.",
    )
    parser.add_argument("--check", action="store_true", help="Check /models before writing cache.")
    args = parser.parse_args()

    base_url, api_key, source = resolve_api_settings(args)
    if not api_key:
        print(
            "Error: no API key found. Configure CODEX_HOME/config.toml or auth.json, "
            "set JUAIHUB_API_KEY/OPENAI_API_KEY, or pass --api-key.",
            file=sys.stderr,
        )
        return 1

    if args.check:
        try:
            check_api(base_url, api_key)
        except RuntimeError as exc:
            print(f"Error: API check failed for {base_url}: {exc}", file=sys.stderr)
            return 1

    out_path = Path(args.out).expanduser().resolve()
    write_cache(out_path, base_url, api_key, source)
    print(f"Wrote local API cache: {out_path}")
    print(f"Base URL: {base_url}")
    print("API key: written, hidden")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
