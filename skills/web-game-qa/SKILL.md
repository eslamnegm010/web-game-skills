---
name: web-game-qa
description: Browser test suites for a web game in muted headless Chrome - smoke test, phones and small laptops (orientation, canvas size, overflow), and portal SDK integration against a fake SDK (CrazyGames) with PASS/FAIL output and screenshots. Use when adding or running end-to-end tests for a browser game, checking a change in the real game, testing on mobile sizes, verifying an ad or SDK integration before an upload, or building a project's quality gate. Requires the web-game-capture skill beside it.
---

# Web game QA

Suites live in the project (`tools/e2e/<name>.e2e.mjs`); the runner, the helpers and the fake SDKs stay here.

| File | Role |
| --- | --- |
| `run.sh` | Builds, serves, runs the suites, prints PASS/FAIL, exits 1 on any failure. |
| `init.sh` | Adds the starter suites to a project (never overwrites). `--sdk` adds the CrazyGames one. |
| `lib/suite.mjs` | `suite(name, options, body)`: browser, `ok`, `info`, `shot`, `noErrors`; `fake(name)`. |
| `fakes/crazygames-sdk.js` | A fake CrazyGames SDK v3 that records every call in `window.__sdk`. |
| `templates/` | `smoke`, `devices`, `sdk.crazygames` starter suites. |

## Set up and run

```sh
bash "${CLAUDE_SKILL_DIR}/init.sh" --sdk     # once per project
bash "${CLAUDE_SKILL_DIR}/run.sh"            # every suite
bash "${CLAUDE_SKILL_DIR}/run.sh" smoke sdk  # some
```

After `init.sh`, adapt each suite: set `READY` to the game's ready signal and fill the `TODO` steps with how a player starts a run in this game. A starter suite that only loads the page proves little.

A file named `<name>.<portal>.e2e.mjs` runs against that portal's build (`npm run build:<portal>`, served from `dist-<portal>`). Screenshots go to `$WEB_GAME_QA_OUT/<suite>/` (default `${TMPDIR:-/tmp}/<repo>-e2e`): open them. The runner empties that folder before each run, and refuses to empty one it did not make.

## Writing a suite

```js
const { suite } = await import(process.env.WEB_GAME_QA);

await suite('weapons', {}, async ({ page, ok, shot, url, noErrors }) => {
  ok('loads', await page.goto(`${url}?debug`, { ready: '!!window.__game' })); // the game shows itself behind ?debug
  await page.ev(`(() => { __game.start(); __game.player.equip('shotgun'); })()`);
  ok('shotgun equipped', await page.until(`__game.player.weapon.id === 'shotgun'`, 5000));
  await shot('shotgun');
  noErrors();
});
```

- One behaviour per `ok`, named as a sentence a person can read in the output.
- Reach states through the game object, check results through it, and take a screenshot where the eye is the judge.
- `page.until(condition, ms)`, never a fixed sleep (headless 3D runs at a few fps).
- End with `noErrors()`: it fails on any uncaught exception or `console.error`.
- A suite that crashes is reported as `FAIL <name> crashed`, not skipped.

## What to cover (in this order)

1. **Smoke:** loads, canvas fills the window, a run starts, no errors.
2. **Devices:** iPhone and Android in both orientations, a 1366x768 laptop. The game starts in any orientation (a "rotate your phone" wall costs a large share of mobile players), nothing is wider than the screen, the canvas follows a rotation. iPhone Safari has no fullscreen and no orientation lock: the template removes them to prove the game does not depend on them.
3. **Portal SDK** (before any upload): with the fake SDK, `loadingStart`/`loadingStop` are sent, `gameplayStart` once per play session, an ad pauses and mutes the game and gives it back, an unfilled rewarded ad gives no reward, the site's mute button silences the game, saves go through the SDK.
4. **The game's own rules:** one suite per system that has broken before.

## The fake SDK

`inject: [fake('crazygames-sdk')]` loads it before the game. Then in the page: `__sdk.calls` (names in order), `__sdk.adMode = 'error'` (next ads fail as unfilled), `__sdk.data` (the Data module's Map), `__sdk.settingsListener({ muteAudio: true })`, `__sdk.joinListener({ room: 'ABCD' })`. For another portal, write a fake the same way from that portal's SDK docs (see the `web-game-portals` skill) and keep it in the project (`tools/e2e/fakes/<portal>-sdk.js`, injected with `fs.readFileSync`). A fake that works for every game is worth contributing to this skill set upstream, as a pull request.

## Gotchas

- Slow machines make timing checks flaky: re-run a failing timing check before blaming the change, and prefer state checks.
- Two runs side by side need different `WEB_GAME_QA_OUT` folders. Each run only ever closes its own browsers.
- Don't park a test player on something that moves or teleports.
- `tools/e2e/*.e2e.mjs` files are test code: keep them out of the shipped bundle (they are, unless imported from `src/`).
