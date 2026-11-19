#!/usr/bin/env bash
# Builds one Agensi upload per skill: dist/agensi/<skill>.zip holding a single top-level folder <skill>/
# with SKILL.md at its root (Agensi's required layout), the MIT LICENSE, and a short README that names the
# sibling skills it needs. Text files only: no symlinks, no .DS_Store.
#   bash tools/agensi-zips.sh
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
out="$repo/dist/agensi"; stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
rm -rf "$out"; mkdir -p "$out"
version="$(node -p 'require(process.argv[1]).version' "$repo/skills.json")"
for dir in "$repo"/skills/*/; do
  n="$(basename "$dir")"
  cp -R "$dir" "$stage/$n"
  find "$stage/$n" -name '.DS_Store' -delete
  [[ -f "$stage/$n/LICENSE" ]] || cp "$repo/LICENSE" "$stage/$n/LICENSE"
  needs="$(node -p 'const m = require(process.argv[1]); (m.requires[process.argv[2]] ?? []).join(", ")' "$repo/skills.json" "$n")"
  desc="$(node -e 'const s = require("fs").readFileSync(process.argv[1], "utf8"); const m = /^description:\s*>?\s*\n?([\s\S]*?)\n(?:[a-z-]+:|---)/m.exec(s); console.log((m?.[1] ?? "").replace(/\s+/g, " ").trim())' "$stage/$n/SKILL.md")"
  {
    echo "# $n"
    echo
    echo "$desc"
    echo
    echo "Part of **Web Game Skills** $version — seven Claude Code skills for building and shipping browser games:"
    echo "https://github.com/eslamnegm010/web-game-skills"
    echo
    if [[ -n "$needs" ]]; then
      echo "**Install these skills next to it** (same skills folder): $needs. Its scripts call them by folder."
    else
      echo "Works on its own."
    fi
    echo
    echo "Requirements: Node 22+, Chrome/Chromium/Edge for browser work, ffmpeg for video, Python 3 + Pillow for covers."
    echo "On Windows, run the .sh scripts from Git Bash. License: MIT (see LICENSE)."
    echo
    cat "$repo/tools/agensi-security-notes.md"
  } >"$stage/$n/README.md"
  (cd "$stage" && zip -qrX "$out/$n.zip" "$n")
  echo "$out/$n.zip  ($(du -h "$out/$n.zip" | cut -f1))"
done
