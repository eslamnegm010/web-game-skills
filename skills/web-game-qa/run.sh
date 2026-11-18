#!/usr/bin/env bash
# Runs the project's browser suites in muted headless Chrome against the built game.
#   run.sh                 every suite in tools/e2e/
#   run.sh smoke devices   only those
# A suite is a file tools/e2e/<name>.e2e.mjs. A file named <name>.<platform>.e2e.mjs runs against that
# platform's build (`npm run build:<platform>`, served from dist-<platform>).
# Screenshots: $OUT/<suite>/ (default: $TMPDIR/<repo>-e2e). Exit code 1 when any check fails.
set -uo pipefail
skill_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root"
E2E_DIR="${E2E_DIR:-tools/e2e}"
export OUT="${OUT:-${TMPDIR:-/tmp}/$(basename "$root")-e2e}"
export WEB_GAME_QA="$skill_dir/lib/suite.mjs"
preview="$skill_dir/../web-game-capture/with-preview.sh"
[[ -x "$preview" ]] || { echo "web-game-capture skill is missing next to web-game-qa" >&2; exit 2; }
shopt -s nullglob
files=("$E2E_DIR"/*.e2e.mjs)
[[ ${#files[@]} -gt 0 ]] || { echo "no suites in $E2E_DIR (run init.sh to add the starter suites)" >&2; exit 2; }
rm -rf "$OUT"; mkdir -p "$OUT"

wanted() { [[ $# -eq 1 ]] && return 0; local n="$1"; shift; for w in "$@"; do [[ "$w" == "$n" ]] && return 0; done; return 1; }
platform_of() { local b; b="$(basename "$1" .e2e.mjs)"; [[ "$b" == *.* ]] && echo "${b##*.}" || echo ""; }

platforms=()
for f in "${files[@]}"; do
  p="$(platform_of "$f")"
  [[ " ${platforms[*]-} " == *" [$p] "* ]] || platforms+=("[$p]")
done

total_fail=0; total_pass=0; ran=0
for tagged in "${platforms[@]}"; do
  p="${tagged:1:${#tagged}-2}"
  group=()
  for f in "${files[@]}"; do
    name="$(basename "$f" .e2e.mjs)"; name="${name%%.*}"
    [[ "$(platform_of "$f")" == "$p" ]] && wanted "$name" "$@" && group+=("$f")
  done
  [[ ${#group[@]} -gt 0 ]] || continue
  runner="$(mktemp)"
  {
    echo 'status=0'
    for f in "${group[@]}"; do
      name="$(basename "$f" .e2e.mjs)"
      printf 'echo "== %s"; o="$(node %q 2>&1)"; echo "$o" | grep -E "^(PASS|FAIL|INFO)" || echo "FAIL %s crashed: $(echo "$o" | grep -vE "^\\s*$" | grep -E "Error|error" | head -1)"\n' "$name" "$f" "$name"
    done
  } >"$runner"
  log="$(mktemp)"
  if [[ -n "$p" ]]; then "$preview" -p "$p" -- bash "$runner" | tee "$log"; else "$preview" -- bash "$runner" | tee "$log"; fi
  total_pass=$((total_pass + $(grep -c '^PASS' "$log" || true)))
  total_fail=$((total_fail + $(grep -c '^FAIL' "$log" || true)))
  ran=$((ran + ${#group[@]}))
  rm -f "$runner" "$log"
done
pkill -f "web-game-chrome-" 2>/dev/null || true
echo
echo "$ran suites · $total_pass passed · $total_fail failed · screenshots: $OUT"
[[ $ran -gt 0 && $total_fail -eq 0 && $total_pass -gt 0 ]]
