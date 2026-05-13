#!/usr/bin/env bash
# scripts/init.sh — load Zernio environment + report status.
#
# Run this FIRST when starting any publishing task. It:
#   1. Sources .env if it exists (no harm if it doesn't)
#   2. Validates ZERNIO_API_KEY is set and looks real
#   3. Probes the Zernio API to confirm the key authenticates
#   4. Prints what's loaded so you (the agent) know where you stand
#
# Usage:
#   source scripts/init.sh           (recommended — exports survive into your shell)
#   bash scripts/init.sh             (one-shot check, exports do NOT survive)

# Detect if we were sourced or run as a script.
# Sourced: we want exports to persist. Run: we just report.
SOURCED=0
(return 0 2>/dev/null) && SOURCED=1

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# 1. Source .env if present
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  ENV_SOURCED="yes ($ENV_FILE)"
else
  ENV_SOURCED="no (no .env at $PROJECT_ROOT)"
fi

# 2. Validate the key
KEY="${ZERNIO_API_KEY:-}"
PLACEHOLDER="zk_replace_with_your_real_key"

if [[ -z "$KEY" ]]; then
  KEY_STATUS="MISSING — ZERNIO_API_KEY is not set"
  KEY_OK=0
elif [[ "$KEY" == "$PLACEHOLDER" ]]; then
  KEY_STATUS="PLACEHOLDER — .env still has the default; user must edit it"
  KEY_OK=0
elif [[ ! "$KEY" =~ ^zk_ ]]; then
  # Heuristic: real Zernio keys start with zk_. Accept anyway but flag.
  KEY_STATUS="LOOKS UNUSUAL — value doesn't start with zk_ (continuing anyway)"
  KEY_OK=1
else
  # Mask all but the first 5 chars for the printout
  KEY_PREVIEW="${KEY:0:5}...${KEY: -4}"
  KEY_STATUS="OK — loaded ($KEY_PREVIEW)"
  KEY_OK=1
fi

# 3. Probe Zernio if the key looks usable
PROBE_STATUS="skipped (no usable key)"
ACCOUNTS_COUNT="-"
if [[ "$KEY_OK" == "1" ]] && command -v curl >/dev/null 2>&1; then
  HTTP=$(curl -s -o /tmp/zernio-init-probe.json -w "%{http_code}" \
    -H "Authorization: Bearer $KEY" \
    "https://zernio.com/api/v1/accounts" 2>/dev/null || echo "000")
  case "$HTTP" in
    200)
      if command -v jq >/dev/null 2>&1; then
        ACCOUNTS_COUNT=$(jq 'length' < /tmp/zernio-init-probe.json 2>/dev/null || echo "?")
      else
        ACCOUNTS_COUNT="? (jq not installed)"
      fi
      PROBE_STATUS="OK (HTTP 200 from /v1/accounts)"
      ;;
    401)
      PROBE_STATUS="UNAUTHORIZED — key was rejected by Zernio (regenerate?)"
      KEY_OK=0
      ;;
    000)
      PROBE_STATUS="NETWORK — couldn't reach zernio.com"
      ;;
    *)
      PROBE_STATUS="HTTP $HTTP from /v1/accounts (check key + status page)"
      ;;
  esac
  rm -f /tmp/zernio-init-probe.json
fi

# 4. Report
cat <<EOF

=== zernio-publish init ===
project root:      $PROJECT_ROOT
cwd:               $(pwd)
.env sourced:      $ENV_SOURCED
ZERNIO_API_KEY:    $KEY_STATUS
zernio probe:      $PROBE_STATUS
connected accounts: $ACCOUNTS_COUNT
ffmpeg:            $(command -v ffmpeg >/dev/null && echo "yes ($(ffmpeg -version 2>&1 | head -1))" || echo "no — install for video conversion")
gdown:             $(command -v gdown >/dev/null && echo "yes" || echo "no — pip install gdown for Drive folder fetches")
jq:                $(command -v jq >/dev/null && echo "yes" || echo "no — install for JSON parsing")

EOF

if [[ "$SOURCED" == "1" ]]; then
  return 0
else
  exit 0
fi
