#!/usr/bin/env bash
# Builds a Vite project, serves the build on a free port, runs a command with URL and PORT set, then stops
# the server. Run from the project root.
#   with-preview.sh [-p <platform>] [--no-build] -- <command...>
#   -p crazygames   builds with `npm run build:crazygames` and serves dist-crazygames
# Use the built game, not the dev server: hot reload restarts the page in the middle of a run.
set -euo pipefail
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
npx vite preview --outDir "$dist" --port "$PORT" --strictPort >"$log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; rm -f "$log"' EXIT
for _ in $(seq 1 100); do
  curl -fsS -o /dev/null "http://localhost:$PORT/" 2>/dev/null && break
  kill -0 "$server" 2>/dev/null || { cat "$log" >&2; exit 1; }
  sleep 0.1
done
export PORT URL="http://localhost:$PORT/"
"$@"
