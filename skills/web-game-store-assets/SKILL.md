---
name: web-game-store-assets
description: Prepare what a game portal upload needs besides the code - the upload build (folder and zip without source maps, checked against size limits), cover images in the three required sizes with the game's title, the listing text, a submission log, and a checker that validates covers and preview videos against portal rules. Use when packaging a web game for upload, making or resizing covers or thumbnails, writing the store description, controls or tags, or checking store assets before submitting to CrazyGames or another portal.
---

# Web game store assets

| File | Role |
| --- | --- |
| `init.sh` | Creates `docs/store/` (README, `LISTING.md`, `SUBMISSIONS.md`, folders). Never overwrites. |
| `package.sh` | `package.sh <portal>` → `release/<name>-<portal>/` and `.zip`, no source maps, limits checked. |
| `title-cover.py` | Finished art + the game's name → the three cover sizes. Needs Pillow. |
| `check-assets.sh` | Validates covers and preview videos (sizes, length, silence, weight). Needs ffprobe. |

```sh
A=~/.claude/skills/web-game-store-assets
$A/init.sh "Game Name"
$A/package.sh crazygames
$A/title-cover.py --title "GAME|NAME" --art art/ --out docs/store [--font font.ttf] [--colors "#fff/#0cf,#fff/#f06"]
$A/check-assets.sh
```

## The kit (`docs/store/`)

`cover-landscape-1920x1080.png`, `cover-portrait-800x1200.png`, `cover-square-800x800.png`, `screenshots/`, `videos/preview-landscape-1920x1080.mp4`, `videos/preview-portrait-1080x1620.mp4`, `LISTING.md`, `SUBMISSIONS.md`. Screenshots come from `web-game-capture` (`--gpu --size 1920x1080`), videos from `web-game-trailer`.

## Covers

The cover decides the click-through rate, and that is the first number a portal measures. Weak covers are the most common launch problem; new covers are often the biggest single improvement a launch gets.

- Rules (CrazyGames): **no text but the game's name, no border, no store logos**, the same look in all three sizes. The top-left corner is covered by the portal's "New"/"Hot" label: keep the title and faces out of it.
- What works: the game's **real characters**, large, over a simple background, with one clear action. A cover is seen as a small card: one subject, a big title, strong contrast.
- Art without text first (rendered from the game, or generated), then `title-cover.py` adds the name: `|` starts a new line, each line takes the next colour pair (`fill/edge`), and the title shrinks to fit. Art files: `landscape.png` (16:9), `portrait.png` (2:3), `square.png`.
- Rendering the real characters: a small page in the project that builds the models with a transparent background and returns `canvas.toDataURL()`, shot with `web-game-capture`; compose over the background with Pillow. This part is game-specific: write it in the project's `tools/cover/`.
- Look at every cover at 200 px wide before accepting it.

## The upload build

`package.sh <portal>` runs `npm run build:<portal>`, removes `*.map`, and writes both a folder and a zip:

- **CrazyGames: upload the folder with "Select folder".** Choosing the zip made the site unpack and upload file by file.
- Limits it checks: 250 MB and 1,500 files in total; it warns on absolute paths in `index.html` (portals serve from a sub-folder: `base: "./"` in `vite.config.js`). The first download before play should stay under 20 MB for mobile, which only you can judge: it lists the largest files.

## Listing and submission log

- `LISTING.md`: title (exactly the in-game name), category, tags, age rating with the reason, short description (~160 characters), description (hook first), a controls table for desktop and mobile, tools used. English is the main listing.
- `SUBMISSIONS.md`: every value entered in each portal's form, dates, review replies, metrics. Fill it during the upload: the next version and the next game start from it.

## Before any upload

1. `check-assets.sh` is green, and you have looked at the covers and watched the videos.
2. The portal's own rules are re-read (they change): see `web-game-portals`.
3. The owner has seen the covers. A cover is a judgement of taste: show it, don't just report it.

## Upload gotcha

- Upload with the portal's "Select folder" button and pick the build folder itself (CrazyGames takes no zip). Selecting the files inside the folder in a file picker uploads only the top-level files: `assets/` is missing, the game stays on its loading screen and the CrazyGames QA panel says "SDK not currently detected" with a small total size. Check with curl: `https://<slug>.game-files.crazygames.com/<slug>/<version>/assets/<file>` gives 404 for a missing file.
