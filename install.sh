#!/usr/bin/env bash
# Installs skills from this repository into Claude Code (~/.claude/skills) as symlinks, so `git pull` updates them.
#   install.sh                     list bundles and skills, and what is installed
#   install.sh web-game            install a bundle
#   install.sh web-game-qa ...     install skills (what they require comes along)
#   install.sh --all               install everything
#   install.sh --remove <name...>  remove skills installed from here
#   install.sh --update            git pull, then relink what is installed
# Options: --copy (copy instead of symlink) · --force (replace a skill of the same name that did not come from
# here; the old one is moved to ~/.claude/skills-backup/<time>/) · CLAUDE_SKILLS_DIR=<dir> (another target)
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
command -v node >/dev/null || { echo "node is required (the skills use it too)" >&2; exit 2; }
query() { node -e '
  const m = require(process.argv[1] + "/skills.json"); const [cmd, ...names] = process.argv.slice(2);
  const fs = require("fs"); const all = fs.readdirSync(process.argv[1] + "/skills").filter((d) => fs.existsSync(`${process.argv[1]}/skills/${d}/SKILL.md`)).sort();
  if (cmd === "all") console.log(all.join("\n"));
  if (cmd === "bundles") for (const [k, b] of Object.entries(m.bundles)) console.log(`${k}\t${b.description}\t${b.skills.join(" ")}`);
  if (cmd === "resolve") {
    const out = new Set(); const bad = [];
    const add = (n) => { if (m.bundles[n]) return m.bundles[n].skills.forEach(add); if (!all.includes(n)) return bad.push(n); if (out.has(n)) return; (m.requires[n] ?? []).forEach(add); out.add(n); };
    names.forEach(add);
    if (bad.length) { console.error("unknown skill or bundle: " + bad.join(", ")); process.exit(2); }
    console.log([...out].join("\n"));
  }' "$repo" "$@"; }
from_here() { [[ -L "$target/$1" && "$(readlink "$target/$1")" == "$repo/skills/$1" ]] || [[ -f "$target/$1/.installed-from" && "$(cat "$target/$1/.installed-from")" == "$repo" ]]; }
# On Windows (Git Bash / MSYS2), `ln -s` quietly makes a copy unless the shell may create real
# symlinks (Developer Mode or admin) AND MSYS is told to try: ask for a strict native link, then
# check that a link is what we got. A silent copy would drift from the repo and break --update.
try_link() { # try_link <src> <dest>: succeeds only when a real symlink was made
  if [[ -n "${MSYSTEM:-}" ]]; then MSYS=winsymlinks:nativestrict ln -s "$1" "$2" 2>/dev/null; else ln -s "$1" "$2" 2>/dev/null; fi
  [[ -L "$2" ]]
}

mode=install; copy=0; force=0; names=()
while [[ $# -gt 0 ]]; do case "$1" in
  --all) while IFS= read -r n; do names+=("$n"); done < <(query all); shift ;;
  --remove) mode=remove; shift ;;
  --update) mode=update; shift ;;
  --copy) copy=1; shift ;;
  --force) force=1; shift ;;
  -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  -*) echo "unknown option $1" >&2; exit 2 ;;
  *) names+=("$1"); shift ;;
esac; done

if [[ $mode == update ]]; then
  git -C "$repo" pull --ff-only
  while IFS= read -r n; do from_here "$n" && names+=("$n"); done < <(query all)
  mode=install
  [[ ${#names[@]} -gt 0 ]] || { echo "nothing installed from here yet"; exit 0; }
fi

if [[ ${#names[@]} -eq 0 ]]; then
  echo "Bundles:"
  query bundles | while IFS=$'\t' read -r k d s; do printf '  %-10s %s\n             %s\n' "$k" "$d" "$s"; done
  echo; echo "Skills ($target):"
  query all | while IFS= read -r n; do
    if from_here "$n"; then state="installed"; elif [[ -e "$target/$n" ]]; then state="other copy"; else state="-"; fi
    printf '  %-28s %s\n' "$n" "$state"
  done
  echo; echo "Install: $0 <bundle or skill...>"
  exit 0
fi

mkdir -p "$target"
if [[ $mode == remove ]]; then
  for n in "${names[@]}"; do
    if from_here "$n"; then rm -rf "${target:?}/$n"; echo "removed    $n"; else echo "skipped    $n (not installed from this repository)"; fi
  done
  exit 0
fi

backup=""
while IFS= read -r n; do
  dest="$target/$n"
  if [[ -e "$dest" || -L "$dest" ]] && ! from_here "$n"; then
    if [[ $force -eq 0 ]]; then echo "skipped    $n (another copy exists at $dest; --force replaces it, keeping a backup)"; continue; fi
    backup="${backup:-$HOME/.claude/skills-backup/$(date +%Y%m%d-%H%M%S)}"; mkdir -p "$backup"; mv "$dest" "$backup/$n"
    echo "backed up  $n -> $backup/$n"
  fi
  rm -rf "$dest"
  if [[ $copy -eq 0 ]] && try_link "$repo/skills/$n" "$dest"; then echo "linked     $n"
  else cp -R "$repo/skills/$n" "$dest"; echo "$repo" >"$dest/.installed-from"
    if [[ $copy -eq 1 ]]; then echo "copied     $n"; else echo "copied     $n (no symlink privilege here — on Windows, Developer Mode makes it a live link)"; fi; fi
done < <(query resolve "${names[@]}")
echo "Restart Claude Code (or start a new session) to load new skills."
