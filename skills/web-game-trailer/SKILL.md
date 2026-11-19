---
name: web-game-trailer
description: Record gameplay video of a browser game and cut it into a trailer and the silent hover-preview videos game portals require (landscape 1920x1080 and portrait 1080x1620, 15-20 s, opening on the cover). Films frame by frame under a fake clock so every frame is rendered at full quality on any machine, optionally renders the game's own synthesized sound, and cuts with ffmpeg. Use when asked for a trailer, gameplay video, preview video, promo clip or GIF-like capture of a web game. Requires the web-game-capture skill beside it and ffmpeg.
---

# Web game trailer

A screen recorder drops frames and catches the cursor. This films the real game one frame at a time: a fake clock is injected before the game loads, the game advances exactly 1/60 s per step, and each frame is captured after it is fully rendered. The result is smooth at any resolution and identical on every take (the random generator is seeded).

| File | Role |
| --- | --- |
| `record.mjs` | Films a take: frames + `take.json`. |
| `clock.js` | The fake clock (injected by `record.mjs`). |
| `cut.sh` | `trailer`, `preview`, `sheet` (contact sheet). |
| `mix.mjs` | Renders the take's sound through the game's own synth (optional). |
| `templates/director.js` | The script of a trailer: copy to `tools/trailer/director.js`. |
| `examples/synth-audio.js` | A renderer for `mix.mjs`, for a WebAudio synth engine. |

## Steps

1. **Write the director** (`tools/trailer/director.js` in the project, from the template). It runs inside the page and defines `window.__dir`: `setup()` puts the game in a clean state (skip the tutorial, player can't die, no auto-pause, best graphics, HUD parts hidden); `frame(n, seconds)` sets input and camera before every frame and returns the shot's label, or `null` to end. Use the real game: real enemies, real physics, hard cuts between shots.
2. **Preview cheaply**, one frame in 30 at a small size, and read the contact sheet:
   ```sh
   T="${CLAUDE_SKILL_DIR}"; C="$T/../web-game-capture"; W="${TMPDIR:-/tmp}/trailer"
   bash "$C/with-preview.sh" -- node "$T/record.mjs" '?debug' "$W/prev" --director tools/trailer/director.js --size 1280x720 --every 30
   bash "$T/cut.sh" sheet "$W/prev" "$W/sheet.jpg"
   ```
   Iterate on the director until the sheet tells the story. Each shot must read in one glance.
3. **Film the take** at 1440p (scaled down to 1080p in the cut: sharper edges):
   ```sh
   bash "$C/with-preview.sh" --no-build -- node "$T/record.mjs" '?debug' "$W/full" --director tools/trailer/director.js
   ```
4. **Cut** (from a full take: a `--every 30` preview makes a contact sheet, not a video):
   ```sh
   S=docs/store
   bash "$T/cut.sh" preview "$W/full" $S/cover-landscape-1920x1080.png $S/videos/preview-landscape-1920x1080.mp4
   bash "$T/cut.sh" preview "$W/full" $S/cover-portrait-800x1200.png  $S/videos/preview-portrait-1080x1620.mp4 --size 1080x1620
   bash "$T/cut.sh" trailer "$W/full" $S/videos/trailer-1920x1080.mp4 --cover $S/cover-landscape-1920x1080.png [--audio "$W/audio.wav"]
   ```
5. **Check** with `bash "$T/../web-game-store-assets/check-assets.sh"`, then watch each file once from start to end.

`record.mjs` options: `--size WxH` · `--fps 60` · `--every N` · `--ready "<js>"` (default `!!window.__game`) · `--warmup <frames>` (stepped but not filmed, default 120: lets intro banners pass) · `--max <frames>` (default 3600) · `--seed <n>` · `--software` (no GPU).

## Portal preview rules

The rules themselves live in the portal's reference (CrazyGames: `web-game-portals` → `references/crazygames.md`, "Store assets"; `check-assets.sh` checks the measurable ones). What they mean for filming:

- `cut.sh preview` makes what CrazyGames asks for by default: silent, opening on the cover, 20 s at most. Run it twice, landscape 1920x1080 and portrait `--size 1080x1620`.
- The portrait cut is a centre crop of the same frames, so keep the action in the middle third of the frame.
- No mouse cursor (the director template hides it), no black frames, no promo text such as "Play now".
- Put the best action first: most viewers see two seconds.

## Sound

- A game with a WebAudio synth: log the synth calls in the director (`sounds()`), then `bash "$C/with-preview.sh" --no-build -- node "$T/mix.mjs" '?debug' "$W/full/take.json" "$W/audio.wav" --renderer tools/trailer/audio.js --tail 3` (start from `examples/synth-audio.js`; `--tail` covers the end card).
- A game with audio files, or a music bed: pass any audio file to `cut.sh trailer --audio`. Loudness is normalised to -15 LUFS.
- Preview videos never have sound.

## Gotchas

- The fake clock replaces `performance.now`, `Date.now`, `requestAnimationFrame`, `setTimeout` and `setInterval`. A game that reads time from elsewhere (an `AudioContext` clock, a worker) will not follow: drive that part from the director.
- Anything adaptive must be pinned in `setup()`: dynamic resolution, fps caps, "pause when unfocused", quality auto-tuning.
- Loading still needs real time (network, decoding): `record.mjs` waits on `--ready` while stepping the clock.
- It films on the real GPU by default, a few frames per second at 2560x1440; `--software` works without a GPU at about 1 s per frame. A 20 s take is 1200 frames.
- Frames are JPEG at quality 97: about 1 MB each at 1440p. Film into the temp folder (`${TMPDIR:-/tmp}`), not the repo.
- `mix.mjs` has been used on one game's synth; treat `examples/synth-audio.js` as a starting point, not a drop-in.
