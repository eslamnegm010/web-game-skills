#!/usr/bin/env bash
# Builds one portal's version of the game and makes the upload: a folder and a zip, without source maps.
# Run from the project root.
#   package.sh <portal> [name]      package.sh crazygames      -> release/<name>-crazygames/ and .zip
# <name> defaults to the "name" in package.json. Prints size and file count against the usual portal limits.
set -euo pipefail
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$root"
portal="${1:?usage: package.sh <portal> [name]}"
name="${2:-$(node -p 'require("./package.json").name')}"
dist="dist-$portal"
rm -rf "$dist"
npm run "build:$portal"
[[ -f "$dist/index.html" ]] || { echo "$dist/index.html missing after the build" >&2; exit 1; }
find "$dist" -name '*.map' -delete
find "$dist" -name '.DS_Store' -delete
out="release/$name-$portal"
rm -rf "$out" "$out.zip"; mkdir -p release
cp -R "$dist" "$out"
# Git Bash on Windows ships no `zip`: fall back to PowerShell's Compress-Archive (same layout: files at the root).
if command -v zip >/dev/null; then (cd "$dist" && zip -qr "$root/$out.zip" .)
elif command -v powershell.exe >/dev/null; then powershell.exe -NoProfile -Command "Compress-Archive -Path '$(cygpath -w "$root/$dist")\*' -DestinationPath '$(cygpath -w "$root/$out.zip")' -Force"
else echo "no way to make the zip: install zip, or run this on Windows (PowerShell is built in)" >&2; exit 1; fi

files="$(find "$dist" -type f | wc -l | tr -d ' ')"
kb="$(du -sk "$dist" | cut -f1)"
echo
echo "folder: $out/   (CrazyGames: upload this with \"Select folder\")"
echo "zip:    $out.zip ($(du -h "$out.zip" | cut -f1))"
echo "total:  $((kb / 1024)) MB in $files files"
warn=0
if grep -rlE '(src|href)="/[^/]' "$dist/index.html" >/dev/null 2>&1; then echo "WARN absolute paths in index.html: portals serve the game from a sub-folder (set base: \"./\" in vite.config.js)"; warn=1; fi
[[ "$files" -le 1500 ]] || { echo "WARN more than 1500 files (CrazyGames limit)"; warn=1; }
[[ "$kb" -le 256000 ]] || { echo "WARN more than 250 MB in total (CrazyGames limit)"; warn=1; }
[[ "$kb" -le 20480 ]] || echo "NOTE over 20 MB in total: make sure the first download (what loads before play) stays under 20 MB for mobile"
echo "largest files:"; find "$dist" -type f -exec du -k {} + | sort -rn | head -5 | awk '{printf "  %6d KB  %s\n", $1, $2}'
exit "$warn"
