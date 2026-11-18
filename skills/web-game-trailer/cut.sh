#!/usr/bin/env bash
# Cuts filmed frames into the videos portals ask for. Needs ffmpeg.
#   cut.sh trailer <frames dir> <out.mp4> [--size 1920x1080] [--audio file] [--cover image] [--cover-seconds 3]
#       The trailer for YouTube and socials: 60 fps, optional sound, optional end card on the cover.
#   cut.sh preview <frames dir> <cover image> <out.mp4> [--size 1920x1080] [--max 20]
#       The silent hover preview on the game's card: opens on the cover, 30 fps, 20 s at most.
#       Run it twice: --size 1920x1080 (landscape) and --size 1080x1620 (portrait 2:3, centre crop).
#   cut.sh sheet <frames dir> <out.jpg> [--columns 6]
#       A contact sheet of the frames, to judge a take without watching it.
# Frames wider or taller than the target are scaled to cover it and cropped around the centre.
set -euo pipefail
cmd="${1:-}"; shift || true
command -v ffmpeg >/dev/null || { echo "ffmpeg not found (macOS: brew install ffmpeg · Windows: winget install ffmpeg · Linux: your package manager)" >&2; exit 2; }
# Pick a Python that really runs: Windows ships Store stubs named python.exe/python3.exe that sit on
# PATH, print "Python was not found" and exit 9009, so existing is not enough — probe each candidate.
PY=""
for cand in python3 py python; do
  if command -v "$cand" >/dev/null && "$cand" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' 2>/dev/null; then PY="$cand"; break; fi
done
[[ -n "$PY" ]] || { echo "python 3 not found (needed for take metadata and the contact sheet)" >&2; exit 2; }
take_fps() { "$PY" -c "import json,sys;print(json.load(open(sys.argv[1]+'/take.json'))['fps'])" "$1" 2>/dev/null || echo 60; }
fit() { echo "scale=$1:$2:force_original_aspect_ratio=increase:flags=lanczos,crop=$1:$2,setsar=1"; }

case "$cmd" in
  trailer)
    frames="${1:?frames dir}"; out="${2:?out.mp4}"; shift 2
    size=1920x1080; audio=""; cover=""; cover_s=3
    while [[ $# -gt 0 ]]; do case "$1" in
      --size) size="$2"; shift 2 ;; --audio) audio="$2"; shift 2 ;; --cover) cover="$2"; shift 2 ;;
      --cover-seconds) cover_s="$2"; shift 2 ;; *) echo "unknown option $1" >&2; exit 2 ;; esac; done
    W="${size%x*}"; H="${size#*x}"; fps="$(take_fps "$frames")"
    inputs=(-framerate "$fps" -pattern_type glob -i "$frames/f*.jpg")
    filter="[0:v]$(fit "$W" "$H"),fps=$fps,format=yuv420p,fade=t=in:st=0:d=0.5[a]"
    last="[a]"
    if [[ -n "$cover" ]]; then
      inputs+=(-loop 1 -framerate "$fps" -t "$cover_s" -i "$cover")
      filter+=";[1:v]$(fit "$W" "$H"),fps=$fps,format=yuv420p,fade=t=in:st=0:d=0.5[b];[a][b]concat=n=2:v=1:a=0[v]"
      last="[v]"
    fi
    maps=(-map "$last")
    if [[ -n "$audio" ]]; then
      inputs+=(-i "$audio")
      idx=$([[ -n "$cover" ]] && echo 2 || echo 1)
      filter+=";[$idx:a]loudnorm=I=-15:TP=-1.5[au]"
      maps+=(-map "[au]" -c:a aac -b:a 256k -shortest)
    else
      maps+=(-an)
    fi
    mkdir -p "$(dirname "$out")"
    ffmpeg -y -hide_banner -loglevel error "${inputs[@]}" -filter_complex "$filter" "${maps[@]}" \
      -c:v libx264 -preset slow -crf 16 -movflags +faststart "$out"
    ;;
  preview)
    frames="${1:?frames dir}"; cover="${2:?cover image}"; out="${3:?out.mp4}"; shift 3
    size=1920x1080; max=20
    while [[ $# -gt 0 ]]; do case "$1" in
      --size) size="$2"; shift 2 ;; --max) max="$2"; shift 2 ;; *) echo "unknown option $1" >&2; exit 2 ;; esac; done
    W="${size%x*}"; H="${size#*x}"; fps="$(take_fps "$frames")"
    mkdir -p "$(dirname "$out")"
    ffmpeg -y -hide_banner -loglevel error -loop 1 -framerate "$fps" -t 0.5 -i "$cover" \
      -framerate "$fps" -pattern_type glob -i "$frames/f*.jpg" \
      -filter_complex "[0:v]$(fit "$W" "$H"),fps=$fps,format=yuv420p[c];[1:v]$(fit "$W" "$H"),fps=$fps,format=yuv420p[a];[c][a]xfade=transition=fade:duration=0.25:offset=0.25,fps=30,format=yuv420p[v]" \
      -map "[v]" -an -t "$max" -c:v libx264 -profile:v high -pix_fmt yuv420p -color_range tv -preset slow -crf 20 -movflags +faststart "$out"
    ;;
  sheet)
    frames="${1:?frames dir}"; out="${2:?out.jpg}"; shift 2
    cols=6; [[ "${1:-}" == "--columns" ]] && cols="$2"
    "$PY" - "$frames" "$out" "$cols" <<'PY'
import glob, sys
from PIL import Image
frames, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3])
files = sorted(glob.glob(frames + '/f*.jpg'))
if not files: sys.exit('no frames in ' + frames)
step = max(1, len(files) // 48)
files = files[::step]
first = Image.open(files[0]); w = 320; h = round(w * first.height / first.width)
sheet = Image.new('RGB', (w * cols, h * ((len(files) + cols - 1) // cols)))
for i, f in enumerate(files):
    sheet.paste(Image.open(f).resize((w, h)), ((i % cols) * w, (i // cols) * h))
sheet.save(out, quality=88)
print(f'{out}: {len(files)} frames')
PY
    exit 0
    ;;
  *) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2 ;;
esac
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_type,width,height,r_frame_rate -of compact=nk=0 "$out"
