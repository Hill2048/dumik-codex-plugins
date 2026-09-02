#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "requests>=2.28.1",
# ]
# ///
"""
Run a saved RunningHub workflow or AI app preset and download image outputs.

The preset stores workflow/app and input mapping. API keys stay in env vars or
are passed at runtime; do not commit them with presets.
"""

from __future__ import annotations

import argparse
import ast
import json
import mimetypes
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests


DEFAULT_API_BASE_URL = "https://www.runninghub.cn"
DEFAULT_POLL_INTERVAL = 5
DEFAULT_TIMEOUT = 900
SUCCESS_STATUSES = {"SUCCESS", "SUCCEED", "FINISHED", "COMPLETED", "COMPLETED_SUCCESS"}
FAIL_STATUSES = {"FAILED", "FAIL", "ERROR", "CANCELED", "CANCELLED", "TIMEOUT"}


class RunningHubError(Exception):
    pass


def codex_home() -> Path:
    return Path(os.getenv("CODEX_HOME") or (Path.home() / ".codex"))


def script_root() -> Path:
    return Path(__file__).resolve().parent


def default_preset_path(preset: str) -> Path:
    return codex_home() / "dumik-team-plugin" / "runninghub-presets" / f"{preset}.json"


def api_settings_path() -> Path:
    return codex_home() / "dumik-team-plugin" / "api_settings.py"


def read_api_settings_constant(name: str) -> str:
    path = api_settings_path()
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="ignore")
    match = re.search(rf"^{name}\s*=\s*(.+)$", text, re.MULTILINE)
    if not match:
        return ""
    try:
        value = ast.literal_eval(match.group(1).strip())
    except (SyntaxError, ValueError):
        return ""
    return value.strip() if isinstance(value, str) else ""


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RunningHubError(f"Config not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RunningHubError(f"Invalid JSON config: {path}") from exc


def clean_base_url(value: str | None) -> str:
    return (value or DEFAULT_API_BASE_URL).rstrip("/")


def api_url(base_url: str, endpoint: str) -> str:
    return f"{clean_base_url(base_url)}/{endpoint.lstrip('/')}"


def auth_headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"}


def api_key_from_args(args: argparse.Namespace, config: dict[str, Any]) -> str:
    if args.api_key:
        return args.api_key
    api_key = read_api_settings_constant("RUNNINGHUB_API_KEY")
    if api_key:
        return api_key
    env_name = args.api_key_env or config.get("apiKeyEnv") or "RUNNINGHUB_API_KEY"
    api_key = os.getenv(env_name, "").strip()
    if api_key:
        return api_key
    raise RunningHubError(
        f"Missing RunningHub API key. Set {api_settings_path()} RUNNINGHUB_API_KEY, ${env_name}, or pass --api-key."
    )


def extract_api_data(body: dict[str, Any]) -> Any:
    code = body.get("code")
    if code not in (None, 0, "0", 200, "200"):
        message = body.get("msg") or body.get("message") or json.dumps(body, ensure_ascii=False)
        raise RunningHubError(f"RunningHub API error: {message}")
    if "data" in body:
        return body["data"]
    if "result" in body:
        return body["result"]
    return body


def post_json(session: requests.Session, url: str, payload: dict[str, Any], timeout: int) -> Any:
    response = session.post(url, json=payload, headers=auth_headers(str(payload.get("apiKey", ""))), timeout=timeout)
    response.raise_for_status()
    return extract_api_data(response.json())


def upload_file(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    image_path: Path,
    timeout: int,
) -> str:
    upload_url = api_url(base_url, "/openapi/v2/media/upload/binary")
    mime = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
    with image_path.open("rb") as handle:
        files = {"file": (image_path.name, handle, mime)}
        response = session.post(upload_url, files=files, headers=auth_headers(api_key), timeout=timeout)
    response.raise_for_status()
    payload = extract_api_data(response.json())
    if isinstance(payload, str):
        return payload
    for key in ("fileName", "filename", "file", "name"):
        value = payload.get(key) if isinstance(payload, dict) else None
        if value:
            return str(value)
    raise RunningHubError(f"Upload response has no fileName: {payload}")


def parse_node_set(value: str) -> dict[str, str]:
    if "=" not in value:
        raise RunningHubError(f"Invalid --set-node value, expected node.field=value: {value}")
    left, field_value = value.split("=", 1)
    if "." not in left:
        raise RunningHubError(f"Invalid --set-node target, expected node.field: {left}")
    node_id, field_name = left.split(".", 1)
    if not node_id or not field_name:
        raise RunningHubError(f"Invalid --set-node target, expected node.field: {left}")
    return {"nodeId": node_id, "fieldName": field_name, "fieldValue": field_value}


def cli_attr_name(value: str) -> str:
    return value.replace("-", "_")


def build_alias_node_overrides(config: dict[str, Any], args: argparse.Namespace) -> list[dict[str, str]]:
    overrides: list[dict[str, str]] = []
    aliases = config.get("parameterAliases") or {}
    if not isinstance(aliases, dict):
        return overrides
    for alias, mapping in aliases.items():
        if not isinstance(mapping, dict):
            raise RunningHubError("parameterAliases values must be objects")
        value = getattr(args, cli_attr_name(str(alias)), None)
        if value is None:
            continue
        overrides.append(
            {
                "nodeId": str(mapping["nodeId"]),
                "fieldName": str(mapping.get("fieldName") or "value"),
                "fieldValue": str(value),
            }
        )
    return overrides


def merge_node_info_list(items: list[dict[str, str]]) -> list[dict[str, str]]:
    merged: dict[tuple[str, str], dict[str, str]] = {}
    order: list[tuple[str, str]] = []
    for item in items:
        key = (str(item["nodeId"]), str(item["fieldName"]))
        if key not in merged:
            order.append(key)
        merged[key] = item
    return [merged[key] for key in order]


def resolve_input_value(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    input_config: dict[str, Any],
    args: argparse.Namespace,
    timeout: int,
) -> str:
    source_arg = input_config.get("sourceArg") or input_config.get("name") or "image"
    raw_value = getattr(args, source_arg, None)
    if raw_value is None and source_arg == "image":
        raw_value = args.image
    if raw_value is None:
        default_value = input_config.get("value")
        if default_value is not None:
            return str(default_value)
        raise RunningHubError(f"Missing input value for sourceArg '{source_arg}'")

    mode = (input_config.get("mode") or "upload").lower()
    if mode == "literal":
        return str(raw_value)
    if mode == "url":
        return str(raw_value)

    path = Path(str(raw_value)).expanduser()
    if not path.exists():
        raise RunningHubError(f"Input file not found: {path}")
    return upload_file(
        session,
        base_url=base_url,
        api_key=api_key,
        image_path=path,
        timeout=timeout,
    )


def build_node_info_list(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    config: dict[str, Any],
    args: argparse.Namespace,
    timeout: int,
) -> list[dict[str, str]]:
    node_info: list[dict[str, str]] = []
    for item in config.get("nodeInfoList", []):
        if not isinstance(item, dict):
            raise RunningHubError("nodeInfoList items must be objects")
        node_info.append(
            {
                "nodeId": str(item["nodeId"]),
                "fieldName": str(item["fieldName"]),
                "fieldValue": str(item["fieldValue"]),
            }
        )

    for item in config.get("inputs", []):
        if not isinstance(item, dict):
            raise RunningHubError("inputs items must be objects")
        field_value = resolve_input_value(
            session,
            base_url=base_url,
            api_key=api_key,
            input_config=item,
            args=args,
            timeout=timeout,
        )
        node_info.append(
            {
                "nodeId": str(item["nodeId"]),
                "fieldName": str(item.get("fieldName") or "image"),
                "fieldValue": field_value,
            }
        )

    node_info.extend(build_alias_node_overrides(config, args))

    for value in args.set_node or []:
        node_info.append(parse_node_set(value))

    return merge_node_info_list(node_info)


def create_workflow_task(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    workflow_id: str,
    node_info_list: list[dict[str, str]],
    webhook_url: str | None,
    timeout: int,
) -> str:
    payload: dict[str, Any] = {
        "apiKey": api_key,
        "workflowId": workflow_id,
        "nodeInfoList": node_info_list,
    }
    if webhook_url:
        payload["webhookUrl"] = webhook_url

    data = post_json(
        session,
        api_url(base_url, "/task/openapi/create"),
        payload,
        timeout,
    )
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        for key in ("taskId", "task_id", "id"):
            value = data.get(key)
            if value:
                return str(value)
    raise RunningHubError(f"Create response has no taskId: {data}")


def create_ai_app_task(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    webapp_id: str,
    node_info_list: list[dict[str, str]],
    instance_type: str | None,
    webhook_url: str | None,
    timeout: int,
) -> str:
    payload: dict[str, Any] = {
        "apiKey": api_key,
        "webappId": webapp_id,
        "nodeInfoList": node_info_list,
    }
    if instance_type:
        payload["instanceType"] = instance_type
    if webhook_url:
        payload["webhookUrl"] = webhook_url

    data = post_json(
        session,
        api_url(base_url, "/task/openapi/ai-app/run"),
        payload,
        timeout,
    )
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        for key in ("taskId", "task_id", "id"):
            value = data.get(key)
            if value:
                return str(value)
    raise RunningHubError(f"AI app run response has no taskId: {data}")


def create_task(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    config: dict[str, Any],
    args: argparse.Namespace,
    node_info_list: list[dict[str, str]],
    timeout: int,
) -> tuple[str, str, str]:
    preset_type = str(config.get("type") or config.get("kind") or "workflow").strip().lower()
    webhook_url = args.webhook_url or config.get("webhookUrl")

    if preset_type in {"workflow", "comfyui", "workflows"}:
        workflow_id = args.workflow_id or str(config.get("workflowId") or "").strip()
        if not workflow_id:
            raise RunningHubError("Missing workflowId in config or --workflow-id")
        task_id = create_workflow_task(
            session,
            base_url=base_url,
            api_key=api_key,
            workflow_id=workflow_id,
            node_info_list=node_info_list,
            webhook_url=webhook_url,
            timeout=timeout,
        )
        return task_id, "workflow", workflow_id

    if preset_type in {"ai-app", "ai_app", "app", "webapp", "web-app"}:
        webapp_id = args.webapp_id or str(config.get("webappId") or config.get("webAppId") or "").strip()
        if not webapp_id:
            raise RunningHubError("Missing webappId in config or --webapp-id")
        task_id = create_ai_app_task(
            session,
            base_url=base_url,
            api_key=api_key,
            webapp_id=webapp_id,
            node_info_list=node_info_list,
            instance_type=args.instance_type or config.get("instanceType"),
            webhook_url=webhook_url,
            timeout=timeout,
        )
        return task_id, "ai-app", webapp_id

    raise RunningHubError(f"Unsupported preset type: {preset_type}")


def normalize_status(data: Any) -> str:
    if isinstance(data, str):
        return data.upper()
    if isinstance(data, dict):
        for key in ("taskStatus", "status", "state", "task_state"):
            value = data.get(key)
            if value:
                return str(value).upper()
    return ""


def query_status(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    task_id: str,
    timeout: int,
) -> Any:
    payload = {"apiKey": api_key, "taskId": task_id}
    return post_json(
        session,
        api_url(base_url, "/task/openapi/status"),
        payload,
        timeout,
    )


def query_outputs(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    task_id: str,
    timeout: int,
) -> Any:
    payload = {"apiKey": api_key, "taskId": task_id}
    return post_json(
        session,
        api_url(base_url, "/task/openapi/outputs"),
        payload,
        timeout,
    )


def validate_auth(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    timeout: int,
) -> Any:
    response = session.post(
        api_url(base_url, "/openapi/v2/resource/list"),
        headers=auth_headers(api_key),
        timeout=timeout,
    )
    response.raise_for_status()
    return extract_api_data(response.json())


def wait_for_task(
    session: requests.Session,
    *,
    base_url: str,
    api_key: str,
    task_id: str,
    poll_interval: int,
    wait_timeout: int,
    request_timeout: int,
) -> Any:
    deadline = time.time() + wait_timeout
    last_status = ""
    while time.time() < deadline:
        data = query_status(
            session,
            base_url=base_url,
            api_key=api_key,
            task_id=task_id,
            timeout=request_timeout,
        )
        status = normalize_status(data)
        if status and status != last_status:
            print(f"status={status}", flush=True)
            last_status = status
        if status in SUCCESS_STATUSES:
            return data
        if status in FAIL_STATUSES:
            raise RunningHubError(f"Task failed: {json.dumps(data, ensure_ascii=False)}")
        time.sleep(poll_interval)
    raise RunningHubError(f"Task timed out after {wait_timeout}s: {task_id}")


def collect_urls(value: Any) -> list[str]:
    urls: list[str] = []
    if isinstance(value, str):
        parsed = urlparse(value)
        if parsed.scheme in {"http", "https"}:
            urls.append(value)
    elif isinstance(value, list):
        for item in value:
            urls.extend(collect_urls(item))
    elif isinstance(value, dict):
        preferred_keys = (
            "fileUrl",
            "file_url",
            "imageUrl",
            "image_url",
            "url",
            "path",
        )
        for key in preferred_keys:
            if key in value:
                urls.extend(collect_urls(value[key]))
        for key, item in value.items():
            if key not in preferred_keys:
                urls.extend(collect_urls(item))
    seen: set[str] = set()
    unique: list[str] = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique.append(url)
    return unique


def extension_from_url(url: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix and len(suffix) <= 6:
        return suffix
    return ".png"


def download_outputs(
    session: requests.Session,
    *,
    urls: list[str],
    out_dir: Path,
    timeout: int,
    filename_prefix: str,
) -> list[str]:
    saved: list[str] = []
    out_dir.mkdir(parents=True, exist_ok=True)
    for index, url in enumerate(urls, start=1):
        output_path = out_dir / f"{filename_prefix}-{index:03d}{extension_from_url(url)}"
        response = session.get(url, timeout=timeout)
        response.raise_for_status()
        output_path.write_bytes(response.content)
        saved.append(str(output_path))
    return saved


def resolve_config_path(args: argparse.Namespace) -> Path:
    if args.config:
        return Path(args.config).expanduser()
    return default_preset_path(args.preset)


def resolve_output_dir(args: argparse.Namespace) -> Path:
    if args.out_dir:
        return Path(args.out_dir).expanduser()
    downloads = Path(os.getenv("USERPROFILE", str(Path.home()))) / "Downloads"
    return downloads / f"rh-{datetime.now().strftime('%Y%m%d')}"


def run(args: argparse.Namespace) -> None:
    config_path = resolve_config_path(args)
    config = load_json(config_path)
    if not isinstance(config, dict):
        raise RunningHubError("Preset config must be a JSON object")

    base_url = clean_base_url(args.base_url or read_api_settings_constant("RUNNINGHUB_API_BASE_URL") or config.get("apiBaseUrl"))
    api_key = api_key_from_args(args, config)
    request_timeout = int(args.request_timeout or config.get("requestTimeoutSeconds") or 120)
    poll_interval = int(args.poll_interval or config.get("pollIntervalSeconds") or DEFAULT_POLL_INTERVAL)
    wait_timeout = int(args.timeout or config.get("timeoutSeconds") or DEFAULT_TIMEOUT)
    out_dir = resolve_output_dir(args)
    filename_prefix = f"{args.preset}-{datetime.now().strftime('%H%M%S')}"

    session = requests.Session()
    if args.validate_auth:
        auth_data = validate_auth(
            session,
            base_url=base_url,
            api_key=api_key,
            timeout=request_timeout,
        )
        if isinstance(auth_data, dict):
            records = auth_data.get("records") or []
            print(
                json.dumps(
                    {
                        "ok": True,
                        "total": auth_data.get("total"),
                        "current": auth_data.get("current"),
                        "size": auth_data.get("size"),
                        "sampleCount": len(records) if isinstance(records, list) else None,
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )
        else:
            print(json.dumps({"ok": True}, ensure_ascii=False), flush=True)
        return

    node_info_list = build_node_info_list(
        session,
        base_url=base_url,
        api_key=api_key,
        config=config,
        args=args,
        timeout=request_timeout,
    )
    task_id, preset_type, remote_id = create_task(
        session,
        base_url=base_url,
        api_key=api_key,
        config=config,
        args=args,
        node_info_list=node_info_list,
        timeout=request_timeout,
    )
    print(f"taskId={task_id}", flush=True)

    status_data = wait_for_task(
        session,
        base_url=base_url,
        api_key=api_key,
        task_id=task_id,
        poll_interval=poll_interval,
        wait_timeout=wait_timeout,
        request_timeout=request_timeout,
    )
    outputs = query_outputs(
        session,
        base_url=base_url,
        api_key=api_key,
        task_id=task_id,
        timeout=request_timeout,
    )
    urls = collect_urls(outputs)
    saved_files = download_outputs(
        session,
        urls=urls,
        out_dir=out_dir,
        timeout=request_timeout,
        filename_prefix=filename_prefix,
    )
    print(f"outputs={len(saved_files)}", flush=True)
    for path in saved_files:
        print(path, flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a RunningHub workflow or AI app preset.")
    parser.add_argument("--preset", default="upscale", help="Preset name. Default: upscale.")
    parser.add_argument("--config", help="Preset JSON path. Defaults to CODEX_HOME/dumik-team-plugin/runninghub-presets/<preset>.json.")
    parser.add_argument("--workflow-id", help="Override workflowId from preset.")
    parser.add_argument("--webapp-id", help="Override webappId from AI app preset.")
    parser.add_argument("--instance-type", help="Override RunningHub AI app instanceType.")
    parser.add_argument("--image", help="Input image path for presets using sourceArg=image.")
    parser.add_argument("--reduce-size", type=int, help="Override upscale AI app reduce-size parameter.")
    parser.add_argument("--upscale-size", type=int, help="Override upscale AI app output/enlarge-size parameter.")
    parser.add_argument("--out-dir", help="Directory for downloaded outputs and run record.")
    parser.add_argument("--api-key", help="RunningHub API key. Prefer env var instead.")
    parser.add_argument("--api-key-env", help="Environment variable name for the API key.")
    parser.add_argument("--base-url", help="RunningHub API base URL.")
    parser.add_argument("--set-node", action="append", help="Override node field, e.g. 12.scale=4.")
    parser.add_argument("--webhook-url", help="Optional task callback URL.")
    parser.add_argument("--poll-interval", type=int, help="Polling interval in seconds.")
    parser.add_argument("--timeout", type=int, help="Overall wait timeout in seconds.")
    parser.add_argument("--request-timeout", type=int, help="Single HTTP request timeout in seconds.")
    parser.add_argument("--validate-auth", action="store_true", help="Validate RunningHub auth and exit.")
    args = parser.parse_args()

    try:
        run(args)
    except (RunningHubError, requests.RequestException) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
