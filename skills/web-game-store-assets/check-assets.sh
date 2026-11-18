#!/usr/bin/env bash
# Checks the store kit against the portal's rules before an upload. Needs ffprobe (ffmpeg).
#   check-assets.sh [dir]        default dir: docs/store
# Expected files (CrazyGames profile):
#   cover-landscape-1920x1080.*  cover-portrait-800x1200.*  cover-square-800x800.*
#   videos/preview-landscape-1920x1080.mp4   videos/preview-portrait-1080x1620.mp4
# Videos: 15-20 s, no audio track, 50 MB at most. Exit code 1 when anything is wrong or missing.
set -uo pipefail
dir="${1:-docs/store}"
command -v ffprobe >/dev/null || { echo "ffprobe not found (it comes with ffmpeg: macOS brew install ffmpeg · Windows winget install ffmpeg)" >&2; exit 2; }
fail=0
bad() { echo "FAIL $*"; fail=1; }
good() { echo "PASS $*"; }
dims() { ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$1" 2>/dev/null; }

cover() { # cover <label> <WxH>
  local f; f="$(ls "$dir"/cover-"$1"-*.{png,jpg,jpeg,webp} 2>/dev/null | head -1)"
  [[ -n "$f" ]] || { bad "cover $1: no file $dir/cover-$1-$2.png"; return; }
  local d; d="$(dims "$f")"
  [[ "$d" == "$2" ]] && good "cover $1: $d ($(basename "$f"))" || bad "cover $1: is $d, must be $2 ($(basename "$f"))"
}
video() { # video <label> <WxH>
  local f; f="$(ls "$dir"/videos/preview-"$1"-*.mp4 2>/dev/null | head -1)"
  [[ -n "$f" ]] || { bad "preview $1: no file $dir/videos/preview-$1-$2.mp4"; return; }
  local d dur audio mb
  d="$(dims "$f")"
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
  audio="$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$f" | head -1)"
  mb=$(( $(wc -c <"$f") / 1048576 ))
  [[ "$d" == "$2" ]] && good "preview $1: $d" || bad "preview $1: is $d, must be $2"
  awk -v s="$dur" 'BEGIN { exit !(s >= 15 && s <= 20.05) }' && good "preview $1: ${dur%.*} s" || bad "preview $1: lasts $dur s, must be 15-20 s"
  [[ -z "$audio" ]] && good "preview $1: silent" || bad "preview $1: has an audio track, must be silent"
  [[ "$mb" -le 50 ]] && good "preview $1: $mb MB" || bad "preview $1: $mb MB, 50 MB at most"
}
cover landscape 1920x1080
cover portrait 800x1200
cover square 800x800
video landscape 1920x1080
video portrait 1080x1620
echo
echo "Not checked here (look yourself): covers have no text but the game's name, no border, no store logos;"
echo "previews open on the cover, show real gameplay, no black frames, no mouse cursor, no \"Play now\" text."
exit "$fail"
