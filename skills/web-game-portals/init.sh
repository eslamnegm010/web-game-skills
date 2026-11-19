#!/usr/bin/env bash
# Adds the platform layer to a Vite game: src/platform/ (web + CrazyGames) and the build scripts.
# Never overwrites. Run from the project root.
#   init.sh <save-prefix> [portal...]      init.sh mygame_ crazygames
# <save-prefix> is the prefix of the game's storage keys (for example "mygame_").
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
prefix="${1:?usage: init.sh <save-prefix> [portal...]}"; shift
portals=("$@"); [[ ${#portals[@]} -gt 0 ]] || portals=(crazygames)
dest="$root/${PLATFORM_DIR:-src/platform}"
mkdir -p "$dest"
for f in index.js web.js config.js vite.js; do
  if [[ -e "$dest/$f" ]]; then echo "kept     ${dest#"$root"/}/$f"
  else sed "s|__SAVE_PREFIX__|$prefix|g" "$skill_dir/templates/platform/$f" >"$dest/$f"; echo "created  ${dest#"$root"/}/$f"; fi
done
for p in "${portals[@]}"; do bash "$skill_dir/add-platform.sh" "$p"; done # via bash: survives a lost executable bit
cat <<EOF

Next (see SKILL.md "Wire the game"):
  1. vite.config.js: base "./", plugins: [platformHtml()] from ./${dest#"$root"/}/vite.js
  2. Boot: await platform.init(); platform.loadingStart(); ... platform.loadingStop() when the first screen is ready.
  3. Replace every localStorage call in game code with platform.storage.
  4. gameplayStart/Stop around real play; pause and mute in platform.onAdStart / onAdEnd.
EOF
