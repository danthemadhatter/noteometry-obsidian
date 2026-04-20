#!/bin/bash
# Deploy built plugin files to Obsidian vault for Obsidian Sync.
# Also handles a cold-start recovery path (e.g. after a drive cleanup
# wiped node_modules, main.js, or the vault plugin folder):
#   - installs deps if node_modules is missing
#   - rebuilds if main.js is missing
#   - creates the vault plugin folder if missing
set -euo pipefail
cd "$(dirname "$0")"

DEST="$HOME/Documents/Noteometry/.obsidian/plugins/noteometry"

if [ ! -d node_modules ]; then
  echo "[deploy] node_modules missing — running npm install"
  npm install
fi

if [ ! -f main.js ]; then
  echo "[deploy] main.js missing — running npm run build"
  npm run build
fi

for f in main.js styles.css manifest.json; do
  if [ ! -f "$f" ]; then
    echo "[deploy] ERROR: $f not found in repo root after build" >&2
    exit 1
  fi
done

VAULT_ROOT="$HOME/Documents/Noteometry"
if [ ! -d "$VAULT_ROOT" ]; then
  echo "[deploy] ERROR: vault root missing: $VAULT_ROOT" >&2
  echo "[deploy] Restore the vault from Obsidian Sync (or iCloud/Time Machine), then re-run." >&2
  exit 1
fi

mkdir -p "$DEST"
cp main.js styles.css manifest.json "$DEST/"
cp data.json "$DEST/" 2>/dev/null || true
echo "[deploy] Deployed to $DEST"
