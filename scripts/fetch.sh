#!/usr/bin/env bash
# scripts/fetch.sh — universal media fetcher using only curl + bash.
#
# Hand it a URL, Google Drive link, or local path; it does the right thing
# and drops the file into the target directory.
#
# Usage:
#   bash scripts/fetch.sh <url-or-path> [target-dir]
#
# Examples:
#   bash scripts/fetch.sh "https://drive.google.com/file/d/ABC123/view"   ./media/
#   bash scripts/fetch.sh "https://example.com/video.mp4"                 ./media/
#   bash scripts/fetch.sh "./local-file.mp4"                              ./media/
#
# Note: Drive *folder* URLs aren't supported by this script (the folder
# page is a JS-rendered SPA). If you (the agent) get a folder URL, ask
# the user to share individual file URLs OR download the folder locally
# and pass the directory path. Or use Claude's native web capabilities
# to inspect the folder page and extract file IDs yourself.
#
# Exit codes:
#   0   success — file is in target dir
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

# Google Drive folder — not supported by curl alone; agent should handle natively
if [[ "$INPUT" == *"drive.google.com/drive/folders/"* ]]; then
  echo "Drive folder URLs aren't supported by this script (the folder page renders via JS)." >&2
  echo "Options:" >&2
  echo "  - Ask the user to share individual file URLs instead" >&2
  echo "  - Ask the user to download the folder and share a local path" >&2
  echo "  - Use your native web tools to inspect the folder and extract file IDs" >&2
  exit 1
fi

# Google Drive single file
if [[ "$INPUT" =~ drive\.google\.com/file/d/([^/]+) ]]; then
  FILE_ID="${BASH_REMATCH[1]}"
  echo "detected: Google Drive single file (FILE_ID=$FILE_ID)"
  DIRECT="https://drive.google.com/uc?export=download&id=$FILE_ID"

  # Use curl with cookie handling for the virus-scan warning page that
  # Drive sometimes serves for larger files.
  COOKIE=$(mktemp)
  curl -sL --cookie "$COOKIE" --cookie-jar "$COOKIE" "$DIRECT" -o "$TARGET/drive-file.tmp"

  # If the result is HTML, it's the virus-scan-warning page — extract the confirm token and retry
  if file "$TARGET/drive-file.tmp" 2>/dev/null | grep -qi 'html'; then
    CONFIRM=$(grep -oE 'confirm=[a-zA-Z0-9_-]+' "$TARGET/drive-file.tmp" | head -1 | cut -d= -f2)
    if [[ -n "$CONFIRM" ]]; then
      curl -sL --cookie "$COOKIE" --cookie-jar "$COOKIE" \
        "$DIRECT&confirm=$CONFIRM" -o "$TARGET/drive-file.tmp"
    else
      rm -f "$COOKIE" "$TARGET/drive-file.tmp"
      echo "Drive returned an HTML page instead of the file. The file may be private or too large." >&2
      echo "Ask the user to make the file public, or share it directly." >&2
      exit 1
    fi
  fi
  rm -f "$COOKIE"

  # Detect the file type and rename appropriately
  TYPE=$(file --brief --mime-type "$TARGET/drive-file.tmp" 2>/dev/null || echo "unknown")
  case "$TYPE" in
    video/mp4)        mv "$TARGET/drive-file.tmp" "$TARGET/drive-file.mp4" ;;
    video/quicktime)  mv "$TARGET/drive-file.tmp" "$TARGET/drive-file.mov" ;;
    image/jpeg)       mv "$TARGET/drive-file.tmp" "$TARGET/drive-file.jpg" ;;
    image/png)        mv "$TARGET/drive-file.tmp" "$TARGET/drive-file.png" ;;
    audio/mpeg)       mv "$TARGET/drive-file.tmp" "$TARGET/drive-file.mp3" ;;
    *)                echo "fetched: $TARGET/drive-file.tmp ($TYPE)" ;;
  esac
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
