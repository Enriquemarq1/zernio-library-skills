#!/usr/bin/env bash
# scripts/post.sh — bare-bash one-shot publish flow for zernio-publish.
#
# Usage:   scripts/post.sh ./manifest.json
# Env:     ZERNIO_API_KEY  (required)
# Output:  ./posts/YYYY-MM-DD-{slug}.json
#
# This is the minimal scriptable path. The Claude Code skill at
# .claude/skills/zernio-publish/ does the same thing with an
# interactive approval gate.

set -euo pipefail

MANIFEST="${1:-}"
if [[ -z "$MANIFEST" || ! -f "$MANIFEST" ]]; then
  echo "Usage: $0 path/to/manifest.json" >&2
  exit 2
fi

if [[ -z "${ZERNIO_API_KEY:-}" ]]; then
  echo "ZERNIO_API_KEY is not set. Export it first:" >&2
  echo "  export ZERNIO_API_KEY='zk_xxx'" >&2
  exit 2
fi

for cmd in jq curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required tool: $cmd" >&2
    exit 2
  fi
done

API="https://zernio.com/api/v1"
AUTH=(-H "Authorization: Bearer $ZERNIO_API_KEY")

SLUG=$(jq -r '.slug' "$MANIFEST")
CONTENT=$(jq -r '.content' "$MANIFEST")
VIDEO=$(jq -r '.media.video // empty' "$MANIFEST")
THUMB=$(jq -r '.media.thumbnail // empty' "$MANIFEST")
PLATFORMS=$(jq -r '.platforms | keys[]' "$MANIFEST")

DATE=$(date -u +"%Y-%m-%d")
LOG_DIR="./posts"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$DATE-$SLUG.json"

# Resolve accountId per platform
echo "==> Resolving accounts via GET /accounts"
ACCOUNTS=$(curl -s "$API/accounts" "${AUTH[@]}")
declare -A ACCOUNT_IDS
for p in $PLATFORMS; do
  ID=$(echo "$ACCOUNTS" | jq -r --arg p "$p" '.[] | select(.platform == $p) | .id' | head -n1)
  if [[ -z "$ID" || "$ID" == "null" ]]; then
    echo "Platform '$p' is not connected in your Zernio dashboard." >&2
    exit 1
  fi
  ACCOUNT_IDS[$p]="$ID"
  echo "    $p -> $ID"
done

# Upload media if present
VIDEO_URL=""
THUMB_URL=""
if [[ -n "$VIDEO" && -f "$VIDEO" ]]; then
  SIZE=$(stat -f%z "$VIDEO" 2>/dev/null || stat -c%s "$VIDEO")
  if [[ "$SIZE" -gt 52428800 ]]; then
    echo "Video over 50 MB ($SIZE bytes). External-storage fallback required." >&2
    echo "See reference/zernio-upload.md § Drive Upload Fallback." >&2
    exit 1
  fi
  echo "==> Presigning video"
  PRESIGN=$(curl -s -X POST "$API/media/presign" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"filename\":\"$(basename "$VIDEO")\",\"contentType\":\"video/mp4\"}")
  UP_URL=$(echo "$PRESIGN" | jq -r '.uploadUrl')
  VIDEO_URL=$(echo "$PRESIGN" | jq -r '.publicUrl')
  echo "    PUT $VIDEO -> uploadUrl"
  curl -X PUT "$UP_URL" -H "Content-Type: video/mp4" -T "$VIDEO" --tls-max 1.2 \
    -s -o /dev/null -w "    HTTP %{http_code}\n"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -I "$VIDEO_URL")
  if [[ "$CODE" != "200" ]]; then
    echo "Video HEAD verify failed: $CODE" >&2; exit 1
  fi
fi

if [[ -n "$THUMB" && -f "$THUMB" ]]; then
  echo "==> Presigning thumbnail"
  PRESIGN=$(curl -s -X POST "$API/media/presign" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"filename\":\"$(basename "$THUMB")\",\"contentType\":\"image/jpeg\"}")
  UP_URL=$(echo "$PRESIGN" | jq -r '.uploadUrl')
  THUMB_URL=$(echo "$PRESIGN" | jq -r '.publicUrl')
  echo "    PUT $THUMB -> uploadUrl"
  curl -X PUT "$UP_URL" -H "Content-Type: image/jpeg" -T "$THUMB" --tls-max 1.2 \
    -s -o /dev/null -w "    HTTP %{http_code}\n"
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -I "$THUMB_URL")
  if [[ "$CODE" != "200" ]]; then
    echo "Thumbnail HEAD verify failed: $CODE" >&2; exit 1
  fi
fi

# Build post body
SCHEDULED=$(jq -r '.scheduledFor' "$MANIFEST")
if [[ "$SCHEDULED" == "auto" || -z "$SCHEDULED" ]]; then
  if date -u -v+3M +"%Y-%m-%dT%H:%M:%SZ" >/dev/null 2>&1; then
    SCHEDULED=$(date -u -v+3M +"%Y-%m-%dT%H:%M:%SZ")
  else
    SCHEDULED=$(date -u -d "+3 minutes" +"%Y-%m-%dT%H:%M:%SZ")
  fi
fi

PLATFORMS_JSON=$(jq -n --argjson m "$(cat "$MANIFEST")" --argjson a "$(
  for p in $PLATFORMS; do echo "{\"$p\":\"${ACCOUNT_IDS[$p]}\"}"; done | jq -s 'add'
)" '
  $m.platforms
  | to_entries
  | map({
      platform: .key,
      accountId: $a[.key],
      platformSpecificData: (.value | del(.customContent))
    })
')

MEDIA_ITEMS="[]"
if [[ -n "$VIDEO_URL" ]]; then
  MEDIA_ITEMS=$(jq -n --arg v "$VIDEO_URL" --arg t "$THUMB_URL" \
    '[{url:$v, type:"video", thumbnail:($t|select(length>0))}]')
fi

BODY=$(jq -n \
  --arg c "$CONTENT" \
  --arg s "$SCHEDULED" \
  --argjson m "$MEDIA_ITEMS" \
  --argjson p "$PLATFORMS_JSON" \
  '{content:$c, mediaItems:$m, platforms:$p, scheduledFor:$s}')

# Approval gate
echo
echo "==> Ready to post"
echo "    Platforms:    $(echo "$PLATFORMS" | tr '\n' ' ')"
echo "    ScheduledFor: $SCHEDULED"
echo "    Content:      $(echo "$CONTENT" | head -c 120)..."
echo "    Video:        ${VIDEO_URL:-(none)}"
echo "    Thumbnail:    ${THUMB_URL:-(none)}"
echo
read -r -p "Ship it? (type 'yes' to confirm): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Cancelled. Nothing was posted." >&2
  exit 1
fi

# POST
echo "==> POST $API/posts"
RESP=$(curl -s -X POST "$API/posts" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "$BODY")
echo "$RESP" | jq .

# Log
jq -n \
  --arg slug "$SLUG" \
  --arg scheduledFor "$SCHEDULED" \
  --argjson manifest "$(cat "$MANIFEST")" \
  --argjson response "$RESP" \
  --arg finishedAt "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  '{
    slug:$slug,
    scheduledFor:$scheduledFor,
    finishedAt:$finishedAt,
    manifest:$manifest,
    zernioResponse:$response,
    verification: "pending — re-run after scheduledFor+60s with scripts/verify.sh"
  }' > "$LOG_FILE"

echo "==> Logged to $LOG_FILE"
echo "==> NEXT: verify each platform after scheduledFor+60s (see reference/principles.md § Verification protocol)"
