#!/usr/bin/env bash
# THE LAST STITCH — starts a local server and opens the game.
cd "$(dirname "$0")"
PORT="${1:-8137}"
URL="http://localhost:$PORT"
echo ""
echo "  THE LAST STITCH — a little game about remembering"
echo "  → $URL"
echo "  (Ctrl+C to stop)"
echo ""
if command -v xdg-open >/dev/null 2>&1; then
  ( sleep 1; xdg-open "$URL" >/dev/null 2>&1 ) &
fi
exec python3 -m http.server "$PORT" --bind 127.0.0.1
