#!/usr/bin/env bash
# The repository's checks: static checks, unit tests, then the whole toolchain on examples/minimal-game
# (install, scaffold, portal builds, browser suites, packaging, covers, recording, cutting, asset checks).
#   bash tests/run.sh            everything the machine can run
#   QUICK=1 bash tests/run.sh    static checks and unit tests only (no npm install, no browser, no ffmpeg)
# Runs on macOS, Linux and Windows (Git Bash). Exit code 1 when any check fails.
set -uo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
pass=0; fail=0; skipped=()
ok() { echo "PASS $1"; pass=$((pass + 1)); }
no() { echo "FAIL $1${2:+ ($2)}"; fail=$((fail + 1)); }
check() { local label="$1"; shift; if "$@" >"$work/last.log" 2>&1; then ok "$label"; else no "$label" "$(tail -3 "$work/last.log" | tr '\n' ' ')"; fi; }
skip() { echo "SKIP $1"; skipped+=("$1"); }
have() { command -v "$1" >/dev/null 2>&1; }
PY=""; for c in python3 py python; do if have "$c" && "$c" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' 2>/dev/null; then PY="$c"; break; fi; done

echo "== static"
cd "$repo"
for f in $(git ls-files '*.sh'); do check "bash -n $f" bash -n "$f"; done
for f in $(git ls-files '*.mjs' 'skills/*.js'); do check "node --check $f" node --check "$f"; done
if [[ -n "$PY" ]]; then for f in $(git ls-files '*.py'); do check "python compiles $f" "$PY" -c 'import ast,sys; ast.parse(open(sys.argv[1]).read())' "$f"; done; fi
check "skills.json names real skills with SKILL.md" node -e '
  const fs = require("fs"); const m = require("./skills.json");
  const names = [...Object.values(m.bundles).flatMap((b) => b.skills), ...Object.keys(m.requires), ...Object.values(m.requires).flat()];
  for (const n of names) { const f = `skills/${n}/SKILL.md`; if (!fs.existsSync(f)) throw new Error("missing " + f);
    const name = /^name:\s*(.+)$/m.exec(fs.readFileSync(f, "utf8"))?.[1]?.trim(); if (name !== n) throw new Error(`${f}: name is ${name}`); }'
check "no hard-coded ~/.claude/skills paths in skills" bash -c '! grep -rn "~/.claude/skills" skills'
check "no ffmpeg glob input (unsupported on Windows)" bash -c '! grep -rn -- "-pattern_type glob" skills'
check "no VITE_PLATFORM= script prefix (fails in cmd.exe)" bash -c '! grep -rn "\"VITE_PLATFORM=\" *+" skills'
check "every script is executable in git" bash -c '[[ -z "$(git ls-files -s | awk '"'"'$4 ~ /\.sh$|\/(shot|record|mix)\.mjs$|title-cover\.py$/ && $1 != "100755" { print $4 }'"'"')" ]]'
check "LICENSE at the root" test -f LICENSE

echo "== unit"
check "platform layer unit tests" node --test tests/platform.test.mjs
if [[ -n "$PY" ]] && "$PY" -c 'import PIL' 2>/dev/null; then
  check "title-cover colour parsing (#rgb, #rrggbb, #rrggbbaa)" "$PY" -c '
import importlib.util, sys
spec = importlib.util.spec_from_file_location("tc", sys.argv[1]); tc = importlib.util.module_from_spec(spec); spec.loader.exec_module(tc)
assert tc.rgba("#fff") == (255, 255, 255, 255), tc.rgba("#fff")
assert tc.rgba("#0cf") == (0, 204, 255, 255)
assert tc.rgba("#00ccff80") == (0, 204, 255, 128)' skills/web-game-store-assets/title-cover.py
else skip "title-cover unit test (Python 3 + Pillow)"; fi

[[ -n "${QUICK:-}" ]] && { echo; echo "$pass passed · $fail failed (QUICK)"; [[ $fail -eq 0 ]]; exit; }

echo "== install"
skills="$work/skills"
check "install.sh web-game into an empty skills folder" env CLAUDE_SKILLS_DIR="$skills" bash install.sh web-game
for n in web-game-kit web-game-capture web-game-qa web-game-trailer web-game-store-assets web-game-portals game-code-review; do
  check "installed $n" test -f "$skills/$n/SKILL.md"
done
check "install.sh --copy installs copies" env CLAUDE_SKILLS_DIR="$work/copies" bash install.sh --copy web-game-qa
check "a skill's requirements come along" test -f "$work/copies/web-game-capture/SKILL.md"

echo "== scaffold"
game="$work/game"
cp -R examples/minimal-game "$game"
cd "$game"
git init -q
check "init-game.sh with two portals" bash "$skills/web-game-kit/init-game.sh" "Minimal Game" minimal_ --portals "crazygames playgama"
for f in src/platform/index.js src/platform/crazygames.js src/platform/playgama.js src/platform/vite.js tools/e2e/smoke.e2e.mjs tools/e2e/sdk.crazygames.e2e.mjs docs/store/LISTING.md; do
  check "created $f" test -f "$f"
done
check "build scripts use --mode" node -e 'const s = require("./package.json").scripts; if (!/--mode crazygames/.test(s["build:crazygames"]) || /VITE_PLATFORM=/.test(JSON.stringify(s))) process.exit(1)'
check "init-game.sh again overwrites nothing" bash -c "bash '$skills/web-game-kit/init-game.sh' 'Minimal Game' minimal_ | grep -q 'kept     src/platform/index.js'"

if ! npm install --no-audit --no-fund >"$work/npm.log" 2>&1; then
  no "npm install in the example" "$(tail -3 "$work/npm.log" | tr '\n' ' ')"
else
  ok "npm install in the example"
  echo "== builds"
  check "plain web build" npm run build
  check "web build keeps source maps" bash -c 'ls dist/assets/*.map'
  check "crazygames build" npm run build:crazygames
  check "crazygames build has no source maps" bash -c '! ls dist-crazygames/assets/*.map 2>/dev/null'
  check "crazygames build carries its adapter only" bash -c 'grep -rq "crazygames-sdk-v3" dist-crazygames/assets && ! grep -rq "playgama-bridge" dist-crazygames'
  check "playgama build" npm run build:playgama
  check "playgama build ships playgama-bridge-config.json" test -f dist-playgama/playgama-bridge-config.json
  check "playgama build loads the bridge in <head>" grep -q "bridge.playgama.com/v2/stable/playgama-bridge.js" dist-playgama/index.html

  echo "== browser suites"
  if node -e 'import(process.argv[1]).then((m) => m.findChrome())' "$(node -p 'require("url").pathToFileURL(process.argv[1]).href' "$skills/web-game-capture/lib/browser.mjs")" >/dev/null 2>&1; then
    check "run.sh: every starter suite green" bash "$skills/web-game-qa/run.sh"
    check "run.sh refuses to empty a folder it did not make" bash -c "mkdir -p '$work/precious' && echo keep > '$work/precious/file' && ! WEB_GAME_QA_OUT='$work/precious' bash '$skills/web-game-qa/run.sh' smoke && test -f '$work/precious/file'"
    check "shot.mjs: a phone screenshot" bash "$skills/web-game-capture/with-preview.sh" --no-build -- node "$skills/web-game-capture/shot.mjs" '?debug' "$work/phone.png" --device iphone --wait '!!window.__game'
    check "phone screenshot is 780x1688" node -e 'const b = require("fs").readFileSync(process.argv[1]); if (b.readUInt32BE(16) !== 780 || b.readUInt32BE(20) !== 1688) process.exit(1)' "$work/phone.png"
    cat >"$work/director.js" <<'EOF'
(() => { window.__dir = { setup() { window.__game.start(); }, frame(n) { return n < 20 ? 'run' : null; } }; })();
EOF
    check "record.mjs: a short take under the fake clock" bash "$skills/web-game-capture/with-preview.sh" --no-build -- node "$skills/web-game-trailer/record.mjs" '?debug' "$work/take" --director "$work/director.js" --size 640x360 --software --warmup 5
    check "record.mjs wrote frames and take.json" bash -c "test -f '$work/take/f00019.jpg' && test -f '$work/take/take.json'"
  else
    skip "browser suites, screenshots and recording (no Chrome, Chromium or Edge found)"
  fi

  echo "== package"
  check "package.sh crazygames" bash "$skills/web-game-store-assets/package.sh" crazygames
  if [[ -n "$PY" ]]; then
    check "the zip has forward-slash entries and index.html at its root" "$PY" -c '
import sys, zipfile
names = zipfile.ZipFile(sys.argv[1]).namelist()
assert names and not any("\\" in n for n in names), names[:5]
assert "index.html" in [n.lstrip("./") for n in names], names[:5]' release/minimal-game-crazygames.zip
  fi
fi

echo "== store assets and cutting"
cd "$game"
if have ffmpeg && have ffprobe && [[ -n "$PY" ]] && "$PY" -c 'import PIL' 2>/dev/null; then
  art="$work/art"; mkdir -p "$art"
  ffmpeg -v error -f lavfi -i "testsrc2=size=1920x1080" -frames:v 1 "$art/landscape.png"
  ffmpeg -v error -f lavfi -i "testsrc2=size=800x1200" -frames:v 1 "$art/portrait.png"
  ffmpeg -v error -f lavfi -i "testsrc2=size=800x800" -frames:v 1 "$art/square.png"
  check "title-cover.sh: three covers with short-hex colours" bash "$skills/web-game-store-assets/title-cover.sh" --title "MINIMAL|GAME" --art "$art" --out docs/store --colors "#fff/#0cf,#fff/#f06"
  frames="$work/frames"; mkdir -p "$frames"
  ffmpeg -v error -f lavfi -i "testsrc2=size=1280x720:rate=30" -t 17 -start_number 0 -q:v 4 "$frames/f%05d.jpg"
  echo '{"frames":510,"seconds":17,"fps":30,"size":[1280,720],"every":1,"sounds":null}' >"$frames/take.json"
  check "cut.sh preview landscape" bash "$skills/web-game-trailer/cut.sh" preview "$frames" docs/store/cover-landscape-1920x1080.png docs/store/videos/preview-landscape-1920x1080.mp4
  check "cut.sh preview portrait" bash "$skills/web-game-trailer/cut.sh" preview "$frames" docs/store/cover-portrait-800x1200.png docs/store/videos/preview-portrait-1080x1620.mp4 --size 1080x1620
  check "cut.sh trailer with an end card" bash "$skills/web-game-trailer/cut.sh" trailer "$frames" "$work/trailer.mp4" --cover docs/store/cover-landscape-1920x1080.png
  check "cut.sh sheet" bash "$skills/web-game-trailer/cut.sh" sheet "$frames" "$work/sheet.jpg"
  check "cut.sh refuses a sparse take" bash -c "mkdir -p '$work/sparse' && cp '$frames/f00000.jpg' '$work/sparse/' && echo '{\"fps\":60,\"every\":30}' > '$work/sparse/take.json' && ! bash '$skills/web-game-trailer/cut.sh' preview '$work/sparse' docs/store/cover-landscape-1920x1080.png '$work/x.mp4'"
  check "check-assets.sh: the whole kit passes" bash "$skills/web-game-store-assets/check-assets.sh" docs/store
else
  skip "covers, cutting and asset checks (ffmpeg, ffprobe, Python 3 + Pillow)"
fi

echo
echo "$pass passed · $fail failed${skipped[*]:+ · skipped: ${#skipped[@]}}"
[[ $fail -eq 0 ]]
