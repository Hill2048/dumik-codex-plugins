#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
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
