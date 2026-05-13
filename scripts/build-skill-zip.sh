#!/usr/bin/env bash
# scripts/build-skill-zip.sh
#
# Builds dist/zernio-publish.skill.zip with SKILL.md at the ZIP root.
# This is the shape that claude.ai's Upload Skill UI accepts.
#
# Run from the repo root:
#   bash scripts/build-skill-zip.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_ROOT/.claude/skills/zernio-publish"
DIST="$REPO_ROOT/dist"
OUT="$DIST/zernio-publish.skill.zip"

if [[ ! -f "$SRC/SKILL.md" ]]; then
  echo "Source SKILL.md not found at $SRC" >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "zip command not found. On Windows, run scripts/build-skill-zip.ps1 instead." >&2
  exit 1
fi

mkdir -p "$DIST"
rm -f "$OUT"

# zip from inside SRC so paths in the archive are relative to the skill root.
(cd "$SRC" && zip -qr "$OUT" . -x "*.DS_Store" -x "Thumbs.db")

SIZE_KB=$(($(wc -c < "$OUT") / 1024))
echo "Built $OUT (${SIZE_KB} KB)"
