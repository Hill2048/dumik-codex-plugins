#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE_VERSION_URL="https://raw.githubusercontent.com/Hill2048/dumik-codex-plugins/main/plugins/dumik-team-plugin/assets/skill-versions.json"
REMOTE_ZIP_URL="https://github.com/Hill2048/dumik-codex-plugins/archive/refs/heads/main.zip"

plugin_version() {
  python3 - <<'PY' "$1"
import json, os, sys
root = sys.argv[1]
for rel in ("assets/skill-versions.json", ".codex-plugin/plugin.json"):
    path = os.path.join(root, rel)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        print(data.get("pluginVersion") or data.get("version") or "0.0.0")
        break
else:
    print("0.0.0")
PY
}

version_newer() {
  python3 - <<'PY' "$1" "$2"
import sys
def parts(v):
    out = []
    for part in str(v).split("."):
        try:
            out.append(int(part))
        except ValueError:
            out.append(0)
    return out
left, right = parts(sys.argv[1]), parts(sys.argv[2])
length = max(len(left), len(right))
left += [0] * (length - len(left))
right += [0] * (length - len(right))
print("1" if left > right else "0")
PY
}

if [[ "${SKIP_REMOTE_CHECK:-0}" != "1" ]]; then
  LOCAL_PLUGIN_VERSION="$(plugin_version "$PLUGIN_ROOT")"
  if REMOTE_JSON="$(curl -fsSL "$REMOTE_VERSION_URL" 2>/dev/null)"; then
    REMOTE_PLUGIN_VERSION="$(python3 - <<'PY' "$REMOTE_JSON"
import json, sys
print(json.loads(sys.argv[1]).get("pluginVersion", "0.0.0"))
PY
)"
    echo "Local plugin version: $LOCAL_PLUGIN_VERSION"
    echo "GitHub plugin version: $REMOTE_PLUGIN_VERSION"
    if [[ "$(version_newer "$REMOTE_PLUGIN_VERSION" "$LOCAL_PLUGIN_VERSION")" == "1" ]]; then
      TMP_ROOT="$(mktemp -d)"
      ZIP_PATH="$TMP_ROOT/dumik-codex-plugins-main.zip"
      curl -fsSL "$REMOTE_ZIP_URL" -o "$ZIP_PATH"
      unzip -q "$ZIP_PATH" -d "$TMP_ROOT"
      REMOTE_PLUGIN_ROOT="$TMP_ROOT/dumik-codex-plugins-main/plugins/dumik-team-plugin"
      if [[ ! -d "$REMOTE_PLUGIN_ROOT" ]]; then
        echo "Downloaded GitHub package does not contain plugins/dumik-team-plugin." >&2
        exit 1
      fi
      PLUGIN_ROOT="$REMOTE_PLUGIN_ROOT"
      echo "GitHub check: using newer plugin from GitHub."
      echo "GitHub source: $PLUGIN_ROOT"
    else
      echo "GitHub check: local version is current."
    fi
  else
    echo "GitHub version check failed, continue with local plugin." >&2
  fi
else
  echo "GitHub version check skipped."
fi

SOURCE="$PLUGIN_ROOT/assets/psb-smart-object-tools/uxp"
DIST="$PLUGIN_ROOT/dist"

if [[ ! -f "$SOURCE/manifest.json" || ! -f "$SOURCE/index.html" || ! -f "$SOURCE/js/main.js" ]]; then
  echo "PSB UXP source not found or incomplete: $SOURCE" >&2
  exit 1
fi

VERSION="$(python3 - <<'PY' "$SOURCE/manifest.json"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    print(json.load(f).get('version', 'dev'))
PY
)"

mkdir -p "$DIST"
PACKAGE="$DIST/psb-smart-object-tools-uxp-$VERSION.ccx"
rm -f "$PACKAGE"

(
  cd "$SOURCE"
  zip -qr "$PACKAGE" .
)

UPIA_CANDIDATES=(
  "/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent"
  "/Library/Application Support/Adobe/Adobe Desktop Common/UPI/AdobePluginInstallerAgent"
)

INSTALLED="false"
for UPIA in "${UPIA_CANDIDATES[@]}"; do
  if [[ -x "$UPIA" ]]; then
    "$UPIA" --install "$PACKAGE"
    INSTALLED="true"
    break
  fi
done

echo "Install OK."
echo "Flavor: UXP"
echo "Source: $SOURCE"
echo "Package: $PACKAGE"
echo "Installed by UPIA: $INSTALLED"
echo "Validation: passed"

if [[ "$INSTALLED" != "true" ]]; then
  echo "UPIA not found. Use the CCX package above or load manifest.json with UXP Developer Tool."
fi
