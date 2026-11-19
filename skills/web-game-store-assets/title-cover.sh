#!/usr/bin/env bash
# Runs title-cover.py with a Python 3 that really works, on macOS, Linux and Windows (Git Bash).
#   title-cover.sh --title "MY|GAME" --art <dir> --out <dir> [--font file.ttf] [--colors ...] [--only ...]
# Windows ships Store stubs named python.exe/python3.exe that print "Python was not found" and exit 9009,
# so a name on PATH is not enough: each candidate is probed. Needs Pillow (pip install Pillow).
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")" && pwd)"
PY=""
for cand in python3 py python; do
  if command -v "$cand" >/dev/null && "$cand" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' 2>/dev/null; then PY="$cand"; break; fi
done
[[ -n "$PY" ]] || { echo "python 3 not found (on Windows: install it from python.org; the py launcher is the reliable entry)" >&2; exit 2; }
"$PY" -c 'import PIL' 2>/dev/null || { echo "Pillow is missing: $PY -m pip install Pillow" >&2; exit 2; }
exec "$PY" "$skill_dir/title-cover.py" "$@"
