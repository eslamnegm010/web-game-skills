#!/usr/bin/env bash
# Adds one portal to the project's platform layer: the adapter file, its line in index.js, and the
# `build:<portal>` script. A portal this skill knows (crazygames, y8, gamepix, playgama) gets its tested adapter;
# any other name gets a skeleton to fill in after researching the portal (references/new-portal.md).
#   add-platform.sh <portal> [sdk-global]      add-platform.sh poki PokiSDK
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
name="${1:?usage: add-platform.sh <portal> [sdk-global]}"
[[ "$name" =~ ^[a-z][a-z0-9]*$ ]] || { echo "portal name: lowercase letters and digits only" >&2; exit 2; }
global="${2:-SDK}"
dest="$root/${PLATFORM_DIR:-src/platform}"
rel="${dest#"$root"/}"
[[ -f "$dest/index.js" ]] || { echo "$rel/index.js not found: run init.sh first" >&2; exit 2; }
grep -q "@platform-adapters" "$dest/index.js" || { echo "$rel/index.js has no @platform-adapters marker (not made by this skill): add the adapter by hand" >&2; exit 2; }

if [[ -e "$dest/$name.js" ]]; then
  echo "kept     $rel/$name.js"
elif [[ -f "$skill_dir/templates/platform/$name.js" ]]; then
  cp "$skill_dir/templates/platform/$name.js" "$dest/$name.js"; echo "created  $rel/$name.js"
else
  pascal="$(printf '%s' "$name" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')"
  sed -e "s|__NAME__|$name|g" -e "s|__PASCAL__|$pascal|g" -e "s|__SDK_GLOBAL__|$global|g" \
    "$skill_dir/templates/platform/_adapter.js" >"$dest/$name.js"
  echo "created  $rel/$name.js (skeleton: research the portal, then fill the TODOs)"
  if [[ -f "$dest/vite.js" ]] && ! grep -q "^  $name:" "$dest/vite.js"; then
    NAME="$name" node -e '
      const fs = require("fs"); const f = process.argv[1]; const n = process.env.NAME;
      const s = fs.readFileSync(f, "utf8");
      fs.writeFileSync(f, s.replace("  // @platform-head", "  " + n + ": () => ``, // TODO: SDK tags this portal wants in <head>, or delete this line\n  // @platform-head"));
    ' "$dest/vite.js"
    echo "updated  $rel/vite.js (empty <head> entry)"
  fi
fi

if grep -q "target === \"$name\"" "$dest/index.js"; then
  echo "kept     $rel/index.js ($name already registered)"
else
  NAME="$name" node -e '
    const fs = require("fs"); const f = process.argv[1]; const n = process.env.NAME;
    const s = fs.readFileSync(f, "utf8");
    fs.writeFileSync(f, s.replace("  // @platform-adapters", "  // @platform-adapters\n  if (target === \"" + n + "\") return (await import(\"./" + n + ".js\")).default;"));
  ' "$dest/index.js"
  echo "updated  $rel/index.js"
fi

if [[ -f "$root/package.json" ]]; then
  NAME="$name" node -e '
    const fs = require("fs"); const f = process.argv[1]; const n = process.env.NAME;
    const raw = fs.readFileSync(f, "utf8"); const pkg = JSON.parse(raw);
    pkg.scripts ??= {};
    if (pkg.scripts["build:" + n]) { console.log("kept     package.json (build:" + n + ")"); process.exit(0); }
    pkg.scripts["build:" + n] = "VITE_PLATFORM=" + n + " vite build --outDir dist-" + n + " --emptyOutDir";
    fs.writeFileSync(f, JSON.stringify(pkg, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
    console.log("updated  package.json (build:" + n + ")");
  ' "$root/package.json"
fi
