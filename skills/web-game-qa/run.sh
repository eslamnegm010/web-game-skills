#!/usr/bin/env bash
# Runs the project's browser suites in muted headless Chrome against the built game.
#   run.sh                 every suite in tools/e2e/
#   run.sh smoke devices   only those
# A suite is a file tools/e2e/<name>.e2e.mjs. A file named <name>.<platform>.e2e.mjs runs against that
# platform's build (`npm run build:<platform>`, served from dist-<platform>).
# Screenshots: $WEB_GAME_QA_OUT/<suite>/ (default: ${TMPDIR:-/tmp}/<repo>-e2e). Exit code 1 when any check fails.
set -uo pipefail
skill_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root"
E2E_DIR="${E2E_DIR:-tools/e2e}"
out="${WEB_GAME_QA_OUT:-${OUT:-${TMPDIR:-/tmp}/$(basename "$root")-e2e}}"
preview="$skill_dir/../web-game-capture/with-preview.sh"
[[ -f "$preview" ]] || { echo "web-game-capture skill is missing next to web-game-qa" >&2; exit 2; }
shopt -s nullglob
files=("$E2E_DIR"/*.e2e.mjs)
[[ ${#files[@]} -gt 0 ]] || { echo "no suites in $E2E_DIR (run init.sh to add the starter suites)" >&2; exit 2; }

# The screenshot folder is emptied before a run, so only ever empty a folder this runner made: a marker file
# says so. A folder someone pointed the variable at by mistake (their build output, say) is never touched.
marker=".web-game-qa-out"
if [[ -d "$out" && -n "$(ls -A "$out" 2>/dev/null)" && ! -f "$out/$marker" ]]; then
  echo "refusing to empty $out: it was not made by web-game-qa (set WEB_GAME_QA_OUT to a new folder)" >&2; exit 2
fi
rm -rf "$out"; mkdir -p "$out"; : >"$out/$marker"
# The suites import the helpers by URL: a file:// URL is valid on every OS, a bare C:\ path is not.
WEB_GAME_QA="$(node -p 'require("url").pathToFileURL(process.argv[1]).href' "$skill_dir/lib/suite.mjs")"
# Every Chrome of this run carries this tag in its profile folder name, so a crashed suite's leftover browser
# can be cleaned up without touching any other Chrome (another run, a trailer being filmed).
WEB_GAME_CHROME_TAG="qa$$"
export WEB_GAME_QA WEB_GAME_QA_OUT="$out" OUT="$out" WEB_GAME_CHROME_TAG

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
  if [[ -n "$p" ]]; then bash "$preview" -p "$p" -- bash "$runner" | tee "$log"; else bash "$preview" -- bash "$runner" | tee "$log"; fi
  total_pass=$((total_pass + $(grep -c '^PASS' "$log" || true)))
  total_fail=$((total_fail + $(grep -c '^FAIL' "$log" || true)))
  ran=$((ran + ${#group[@]}))
  rm -f "$runner" "$log"
done
# Only this run's browsers (no pkill on Windows: browser.mjs kills its own Chrome tree there).
command -v pkill >/dev/null && pkill -f "web-game-chrome-$WEB_GAME_CHROME_TAG-" 2>/dev/null || true
echo
echo "$ran suites · $total_pass passed · $total_fail failed · screenshots: $out"
[[ $ran -gt 0 && $total_fail -eq 0 && $total_pass -gt 0 ]]
