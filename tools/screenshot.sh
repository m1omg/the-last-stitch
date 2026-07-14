#!/usr/bin/env bash
# Capture deterministic game states headlessly for visual review.
# Usage: tools/screenshot.sh <shotname> [<shotname> ...]
# Requires the game server running (run.sh) on $PORT (default 8137).
cd "$(dirname "$0")/.."
PORT="${PORT:-8137}"
PROFILE="shots/.ffprofile"
mkdir -p shots "$PROFILE"
for s in "$@"; do
  out="shots/$(echo "$s" | tr -c 'a-zA-Z0-9_\n' '_').png"
  firefox --headless --no-remote --profile "$PROFILE" \
    --window-size=960,640 \
    --screenshot="$PWD/$out" \
    "http://localhost:$PORT/?shot=$s" >/dev/null 2>&1
  if [ -f "$out" ]; then echo "ok  $out"; else echo "FAIL $s"; fi
done
