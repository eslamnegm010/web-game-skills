#!/usr/bin/env bash
# Creates the store kit folder (docs/store/) with its README, listing and submission log. Never overwrites.
#   init.sh ["Game Name"]
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
game="${1:-$(basename "$root")}"
dest="$root/${STORE_DIR:-docs/store}"
mkdir -p "$dest/screenshots" "$dest/videos/raw"
for f in README.md LISTING.md SUBMISSIONS.md; do
  if [[ -e "$dest/$f" ]]; then echo "kept     ${dest#"$root"/}/$f"
  else sed "s|{{GAME_NAME}}|$game|g" "$skill_dir/templates/$f" >"$dest/$f"; echo "created  ${dest#"$root"/}/$f"; fi
done
ignore="$root/.gitignore"
for line in "/release" "${dest#"$root"/}/videos/raw"; do
  grep -qxF "$line" "$ignore" 2>/dev/null || { echo "$line" >>"$ignore"; echo "updated  .gitignore ($line)"; }
done
