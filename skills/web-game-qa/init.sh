#!/usr/bin/env bash
# Adds the starter browser suites to a project (tools/e2e/). Never overwrites. Run from the project root.
#   init.sh [--sdk]   --sdk also adds the CrazyGames fake-SDK suite
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
dir="$root/${E2E_DIR:-tools/e2e}"
mkdir -p "$dir"
names=(smoke.e2e.mjs devices.e2e.mjs)
[[ "${1:-}" == "--sdk" ]] && names+=(sdk.crazygames.e2e.mjs)
for n in "${names[@]}"; do
  if [[ -e "$dir/$n" ]]; then echo "kept     ${dir#"$root"/}/$n"; else cp "$skill_dir/templates/$n" "$dir/$n"; echo "created  ${dir#"$root"/}/$n"; fi
done
echo
echo "Next: set READY in each suite to this game's ready signal, fill the TODO steps, then run:"
echo "  ~/.claude/skills/web-game-qa/run.sh"
