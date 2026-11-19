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
# Making the zip, in order of preference. NOT PowerShell's Compress-Archive: on stock Windows
# (PowerShell 5.1) it writes entry names with backslashes, which portals and non-Windows tools
# reject or mangle. Windows' own bsdtar (System32\tar.exe, Windows 10+) writes correct zips.
zipped=0
if command -v zip >/dev/null && (cd "$dist" && zip -qr "$root/$out.zip" .); then zipped=1
elif [[ -n "${SYSTEMROOT:-}" && -x "${SYSTEMROOT}/System32/tar.exe" ]] && (cd "$dist" && shopt -s dotglob nullglob && "${SYSTEMROOT}/System32/tar.exe" -a -cf "$(cygpath -w "$root/$out.zip")" -- *); then zipped=1
else
  for cand in python3 py python; do
    if command -v "$cand" >/dev/null && "$cand" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' 2>/dev/null; then
      (cd "$dist" && "$cand" -c 'import os, sys, zipfile
with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED) as z:
    for base, _dirs, files in os.walk("."):
        for f in files:
            p = os.path.join(base, f)
            z.write(p, os.path.relpath(p, ".").replace(os.sep, "/"))' "$root/$out.zip") && zipped=1
      break
    fi
  done
fi
[[ $zipped -eq 1 ]] || { echo "no way to make the zip: install zip or Python 3 (on Windows, System32 tar.exe should exist)" >&2; exit 1; }

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
