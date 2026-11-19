---
name: web-game-kit
description: The entry point for building and shipping a browser game (three.js, canvas, Vite) with this skill set - sets up a new or existing game project in one command (portal platform layer, browser tests, store kit) and routes each kind of work to the right skill. Use when starting a web game project, when the user says "set up the game tooling" or "use the game skills here", or when unsure which web-game skill fits a task.
---

# Web game kit

One command prepares a Vite game project; after that each task has its own skill. The skills of this set sit next to each other, so this skill's sibling folders hold the others.

```sh
bash "${CLAUDE_SKILL_DIR}/init-game.sh" "Game Name" gamename_ [--portals "crazygames y8"] [--skip platform,tests,store]
```

Run it from the project root (a git repository: `git init` is enough). It runs each skill's own `init.sh`, and none overwrites an existing file:

| Step | Creates | Skill |
| --- | --- | --- |
| Platform layer | `src/platform/` (web + the portals named, CrazyGames by default), `build:<portal>` scripts | `web-game-portals` |
| Browser tests | `tools/e2e/` smoke, devices and fake-SDK suites | `web-game-qa` |
| Store kit | `docs/store/` listing, submission log, folders | `web-game-store-assets` |

A step whose skill is not installed is skipped with a note: install the whole bundle, not this skill alone.

## After the command (the part that needs judgment)

1. **Wire the platform layer** into the game (`web-game-portals` → "Wire the game"): `vite.config.js`, boot signals, storage, ad hooks.
2. **Make the game drivable:** expose `window.__game` behind `?debug`, then set `READY` and fill the `TODO` steps in `tools/e2e/*.e2e.mjs`.
3. **Give the project one check command** (for example `npm run check`) that builds, runs `${CLAUDE_SKILL_DIR}/../web-game-qa/run.sh` and the platform grep from `web-game-portals`. Write that command and the project's rules into its `CLAUDE.md` (or `AGENTS.md`), so every later change is checked the same way.
4. Run the suites and open the screenshots.
5. Commit.

## Which skill for what

| Task | Skill |
| --- | --- |
| A screenshot, a look at the running game, a phone view | `web-game-capture` |
| End-to-end tests, device checks, SDK integration tests | `web-game-qa` |
| Trailer, gameplay clip, portal preview videos | `web-game-trailer` |
| Covers, listing text, upload package, asset checks | `web-game-store-assets` |
| Portal SDKs, ads, a new portal, submission, metrics, payouts | `web-game-portals` |
| Review a diff of game code before merging | `game-code-review` |

## The usual road to a launch

1. Core loop playable in the browser; play starts within one click, in any orientation.
2. Platform layer in from the start, saves through `platform.storage`.
3. Smoke and devices suites green on every change.
4. Store kit: covers first (they decide the click-through rate), then screenshots, then the preview videos.
5. CrazyGames Basic Launch; read the metrics per device daily; one change at a time.
6. Other portals with `add-platform.sh`, one at a time.
