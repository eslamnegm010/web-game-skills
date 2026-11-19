#!/usr/bin/env bash
# Builds a Vite project, serves the build on a free port, runs a command with URL and PORT set, then stops
# the server. Run from the project root.
#   with-preview.sh [-p <platform>] [--no-build] -- <command...>
#   -p crazygames   builds with `npm run build:crazygames` and serves dist-crazygames
# Use the built game, not the dev server: hot reload restarts the page in the middle of a run.
# The command also gets WEB_GAME_CAPTURE: the driver (lib/browser.mjs) as a file:// URL, ready for
# `await import(process.env.WEB_GAME_CAPTURE)` on every OS (a bare Windows path is not a valid ESM import).
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")" && pwd)"
platform=""; build=1
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p) platform="$2"; shift 2 ;;
    --no-build) build=0; shift ;;
    --) shift; break ;;
    *) echo "usage: with-preview.sh [-p platform] [--no-build] -- <command...>" >&2; exit 2 ;;
  esac
done
[[ $# -gt 0 ]] || { echo "no command given" >&2; exit 2; }
dist="dist${platform:+-$platform}"
if [[ $build -eq 1 ]]; then
  npm run "build${platform:+:$platform}" >/dev/null
fi
[[ -d "$dist" ]] || { echo "$dist not found: build first" >&2; exit 2; }
PORT="$(node -e 'const s=require("net").createServer().listen(0,()=>{console.log(s.address().port);s.close()})')"
log="$(mktemp)"
# Start Vite's own entry with node, not through npx: npx is a wrapper process, and on Windows killing it
# leaves the real server running. One process means `kill` stops the server everywhere.
if [[ -f node_modules/vite/bin/vite.js ]]; then
  node node_modules/vite/bin/vite.js preview --outDir "$dist" --port "$PORT" --strictPort >"$log" 2>&1 &
else
  npx vite preview --outDir "$dist" --port "$PORT" --strictPort >"$log" 2>&1 &
fi
server=$!
trap 'kill "$server" 2>/dev/null || true; rm -f "$log"' EXIT
up=0
for _ in $(seq 1 100); do
  curl -fsS -o /dev/null "http://localhost:$PORT/" 2>/dev/null && { up=1; break; }
  kill -0 "$server" 2>/dev/null || { cat "$log" >&2; exit 1; }
  sleep 0.1
done
[[ $up -eq 1 ]] || { echo "the preview server did not answer on port $PORT" >&2; cat "$log" >&2; exit 1; }
WEB_GAME_CAPTURE="$(node -p 'require("url").pathToFileURL(process.argv[1]).href' "$skill_dir/lib/browser.mjs")"
export PORT URL="http://localhost:$PORT/" WEB_GAME_CAPTURE
"$@"
