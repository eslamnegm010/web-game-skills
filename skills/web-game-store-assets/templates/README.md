# Store assets ({{GAME_NAME}})

Everything to upload when publishing on a portal. Check it with
`~/.claude/skills/web-game-store-assets/check-assets.sh` before every upload.

| File | What |
| --- | --- |
| `cover-landscape-1920x1080.png` | Cover, landscape |
| `cover-portrait-800x1200.png` | Cover, portrait |
| `cover-square-800x800.png` | Cover, square |
| `screenshots/` | Gameplay stills, named `gameplay-<n>-<width>x<height>.png` |
| `videos/preview-landscape-1920x1080.mp4` | Hover preview, landscape: silent, 15-20 s, opens on the cover |
| `videos/preview-portrait-1080x1620.mp4` | Hover preview, portrait 2:3 |
| `videos/trailer-<width>x<height>.mp4` | Trailer with sound, for video sites and socials |
| `videos/raw/` | Original recordings (not committed) |

Listing text (description, controls, tags): `LISTING.md`. What was entered in each portal's form, and what
happened: `SUBMISSIONS.md`.

Upload build: `~/.claude/skills/web-game-store-assets/package.sh <portal>` → `release/`.
