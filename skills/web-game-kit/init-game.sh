#!/usr/bin/env bash
# Prepares a Vite game project with the whole web-game skill set. Run from the project root.
#   init-game.sh "<Game Name>" <save-prefix> [--skip platform,tests,store] [--portals "crazygames y8"]
# Each step calls that skill's own init.sh; none overwrites an existing file.
set -euo pipefail
skills="$(cd "$(dirname "$0")/.." && pwd)"
game="${1:?usage: init-game.sh \"<Game Name>\" <save-prefix> [--skip a,b] [--portals \"crazygames y8\"]}"
prefix="${2:?save prefix, for example mygame_}"
shift 2
skip=""; portals="crazygames"
while [[ $# -gt 0 ]]; do case "$1" in
  --skip) skip=",$2,"; shift 2 ;; --portals) portals="$2"; shift 2 ;; *) echo "unknown option $1" >&2; exit 2 ;; esac; done
git rev-parse --show-toplevel >/dev/null 2>&1 || { echo "not a git repo: git init and make a first commit" >&2; exit 2; }

step() { # step <key> <title> <skill> <script> [args...]
  local key="$1" title="$2" skill="$3" script="$4"; shift 4
  echo; echo "== $title"
  if [[ "$skip" == *",$key,"* ]]; then echo "skipped (--skip)"; return; fi
  if [[ ! -x "$skills/$skill/$script" ]]; then echo "skipped: the $skill skill is not installed"; return; fi
  "$skills/$skill/$script" "$@"
}
# shellcheck disable=SC2086
step platform "Platform layer" web-game-portals init.sh "$prefix" $portals
step tests "Browser tests" web-game-qa init.sh --sdk
step store "Store kit" web-game-store-assets init.sh "$game"
echo
echo "Done. Next: SKILL.md \"After the command\" (write AGENTS.md and the gate, wire the platform layer, fill the suites)."
