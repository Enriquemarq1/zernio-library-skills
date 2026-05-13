#!/usr/bin/env bash
# scripts/fetch.sh — universal media fetcher.
#
# Hand it a URL, Google Drive link, or local path; it does the right thing
# and drops the file(s) into the target directory. No questions about
# "is it authenticated?" — try first, fail clean if it doesn't work.
#
# Usage:
#   bash scripts/fetch.sh <url-or-path> [target-dir]
#
# Examples:
#   bash scripts/fetch.sh "https://drive.google.com/file/d/ABC123/view"      ./media/
#   bash scripts/fetch.sh "https://drive.google.com/drive/folders/XYZ"      ./media/
#   bash scripts/fetch.sh "https://example.com/video.mp4"                   ./media/
#   bash scripts/fetch.sh "./local-file.mp4"                                ./media/
#
# Exit codes:
#   0   success — files are in target dir
#   1   couldn't fetch — input invalid or remote unreachable
#   2   bad arguments

set -euo pipefail

INPUT="${1:-}"
TARGET="${2:-./media}"

if [[ -z "$INPUT" ]]; then
  echo "usage: bash scripts/fetch.sh <url-or-path> [target-dir]" >&2
  exit 2
fi

mkdir -p "$TARGET"

# Local file? Just copy.
if [[ -f "$INPUT" ]]; then
  cp "$INPUT" "$TARGET/"
  echo "copied: $INPUT -> $TARGET/$(basename "$INPUT")"
  exit 0
fi

# Local directory? Copy contents.
if [[ -d "$INPUT" ]]; then
  cp -r "$INPUT"/* "$TARGET/"
  echo "copied directory contents: $INPUT/* -> $TARGET/"
  exit 0
fi

# Google Drive folder
if [[ "$INPUT" == *"drive.google.com/drive/folders/"* ]]; then
  if command -v gdown >/dev/null 2>&1; then
    echo "detected: Google Drive folder — using gdown"
    gdown --folder "$INPUT" -O "$TARGET" --quiet
    echo "fetched: $(ls -1 "$TARGET" | wc -l) files in $TARGET/"
    exit 0
  else
    echo "Google Drive folder detected but gdown is not installed." >&2
    echo "Install: pip install gdown" >&2
    echo "Or: ask the user to download the folder locally and pass the path." >&2
    exit 1
  fi
fi

# Google Drive single file: convert the share URL into a direct-download URL
if [[ "$INPUT" =~ drive\.google\.com/file/d/([^/]+) ]]; then
  FILE_ID="${BASH_REMATCH[1]}"
  echo "detected: Google Drive single file — converting to direct download (FILE_ID=$FILE_ID)"
  DIRECT="https://drive.google.com/uc?export=download&id=$FILE_ID"
  if command -v gdown >/dev/null 2>&1; then
    gdown "$DIRECT" -O "$TARGET/" --quiet
  else
    # Fallback to curl with cookie handling for the virus-scan warning page
    curl -L --cookie /tmp/gcookie -c /tmp/gcookie -o "$TARGET/drive-file" "$DIRECT" 2>/dev/null
    rm -f /tmp/gcookie
    # If we got an HTML virus-scan page, that's a "too big" case
    if file "$TARGET/drive-file" 2>/dev/null | grep -qi 'html'; then
      echo "Drive file is too large for the direct curl path." >&2
      echo "Install gdown (pip install gdown) or ask the user for the file directly." >&2
      rm -f "$TARGET/drive-file"
      exit 1
    fi
  fi
  echo "fetched: Drive file -> $TARGET/"
  exit 0
fi

# Regular https/http URL
if [[ "$INPUT" =~ ^https?:// ]]; then
  FILENAME=$(basename "${INPUT%%\?*}")
  [[ -z "$FILENAME" || "$FILENAME" == "/" ]] && FILENAME="downloaded-file"
  echo "detected: HTTP(S) URL — using curl -L"
  curl -L --tls-max 1.2 -o "$TARGET/$FILENAME" "$INPUT"
  echo "fetched: $TARGET/$FILENAME"
  exit 0
fi

echo "couldn't identify what '$INPUT' is — not a file, not a directory, not a recognized URL pattern" >&2
exit 1
