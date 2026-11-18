---
name: web-game-capture
description: Take screenshots of a browser game (three.js, canvas, any HTML5 game) and drive it in muted headless Chrome - desktop sizes, phone and tablet emulation, waiting for the game to be ready, running JavaScript in the page first. Use when asked for a screenshot, a store or gameplay still, "show me how it looks on a phone", a before/after picture, or when you need to look at the running game to check a visual change. Also the shared browser driver that web-game-qa and web-game-trailer build on.
---

# Web game capture

Screenshots and browser control for web games, with no dependencies (Node 22+, Chrome installed). Scripts run from this folder; nothing is copied into the project.

| File | Role |
| --- | --- |
| `shot.mjs` | One screenshot, or a batch from a JSON file. |
| `with-preview.sh` | Builds the game, serves the build on a free port, runs a command with `URL` set, stops the server. |
| `lib/browser.mjs` | The driver: `launch()`, `goto`, `ev`, `until`, `shot`, `device`, `tap`, `click`, `key`, `inject`. |

## Take a screenshot

From the project root (a Vite project):

```sh
C=~/.claude/skills/web-game-capture
$C/with-preview.sh -- node $C/shot.mjs / out.png --wait '!!window.__game'
$C/with-preview.sh -- node $C/shot.mjs '?debug' phone.png --device iphone --landscape --wait '!!window.__game'
```

`with-preview.sh` builds the game, serves it and sets `URL`; a relative address (`/`, `?debug`) is resolved against it.

Against a server that is already running: `node $C/shot.mjs http://localhost:5173/ out.png`.

Options: `--size 1920x1080` · `--device iphone|android|ipad|chromebook|desktop` · `--landscape` · `--wait "<js expression>"` · `--eval "<js>"` (runs after the wait: open a menu, start a level, hide the HUD) · `--delay <ms>` · `--gpu` (real GPU: sharper, use it for store stills) · `--batch shots.json --out <dir> --base <url>`.

A batch file is a JSON array of `{ "name", "url", "size", "device", "landscape", "wait", "eval", "delay" }`: one browser, many pictures. Keep a project's standard set in `tools/shots.json`.

**Always open the picture and look at it** (Read the file) before reporting. A saved file proves nothing about what is in it.

## Make the game capturable

- Expose the game object behind a flag: `if (new URLSearchParams(location.search).has('debug')) window.__game = game;`. Scripts then wait on `!!window.__game` and set state through it.
- `--eval` runs in the page's global scope: wrap statements in `(() => { ... })()`, because a top-level `const` collides on the second run.
- For a still of a moment in play, set the state directly (`__game.startLevel(3)`) rather than replaying input.

## Rules that came from real failures

- **Chrome is always muted and always killed.** `launch()` passes `--mute-audio` and kills Chrome when the script exits, crashes or is interrupted. Never start Chrome another way for a test: the owner hears leftover sound.
- **Wait on a condition, never on a fixed sleep.** Headless Chrome with the software renderer can run a 3D game at 1-5 fps. `page.until(expr, ms)` polls.
- **Use the built game, not the dev server**: hot reload restarts the page in the middle of a run. `with-preview.sh` does this.
- **Software renderer by default** (same pixels on every machine, works without a GPU); `--gpu` when the picture itself is the product.
- Phone emulation sets the size, pixel ratio, touch and user agent. It does not emulate Safari's missing fullscreen and orientation lock: see `web-game-qa` for that check.
- Screenshots of a phone are at 2x pixel ratio: an iPhone at 390x844 gives a 780x1688 file.

## Using the driver in your own script

```js
import { launch } from '/Users/<you>/.claude/skills/web-game-capture/lib/browser.mjs';
const page = await launch({ width: 1280, height: 720 });
await page.goto(url, { ready: '!!window.__game' });
await page.ev(`(() => { __game.startLevel(2); })()`);
await page.until(`__game.state === 'playing'`);
await page.shot('level-2.png');
console.log(page.errors);          // uncaught exceptions and console.error lines
await page.close();
```
