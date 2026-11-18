---
name: web-game-kit
description: The entry point for building and shipping a browser game (three.js, canvas, Vite) with this skill set - sets up a new or existing game project in one command (portal platform layer, browser tests, store kit) and routes each kind of work to the right skill. Use when starting a web game project, when the user says "set up the game tooling" or "use the game skills here", or when unsure which web-game skill fits a task.
---

# Web game kit

One command prepares a Vite game project; after that each task has its own skill.

```sh
~/.claude/skills/web-game-kit/init-game.sh "Game Name" gamename_
```

It runs each skill's own `init.sh` (none overwrites an existing file):

| Step | Creates | Skill |
| --- | --- | --- |
| Platform layer | `src/platform/` (web + CrazyGames), `build:crazygames` | `web-game-portals` |
| Browser tests | `tools/e2e/` smoke, devices and fake-SDK suites | `web-game-qa` |
| Store kit | `docs/store/` listing, submission log, folders | `web-game-store-assets` |

Skip steps with `--skip platform,tests,store`. A step whose skill is not installed is skipped with a note.

## After the command (the part that needs judgment)

1. **Adapt, don't just scaffold.** Write the project's `AGENTS.md` with its rules and its quality gate with real commands. Add the browser suites and the platform grep to that gate.
2. **Wire the platform layer** into the game (`web-game-portals` → "Wire the game"): `vite.config.js`, boot signals, storage, ad hooks.
3. **Make the game drivable:** expose `window.__game` behind `?debug`, then set `READY` and fill the `TODO` steps in `tools/e2e/*.e2e.mjs`.
4. Run `~/.claude/skills/web-game-qa/run.sh` and look at the screenshots.
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
