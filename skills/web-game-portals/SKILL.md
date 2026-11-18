---
name: web-game-portals
description: Publish an HTML5 or three.js browser game on game portals - CrazyGames by default, with Y8 and GamePix adapters included and a research procedure for any other portal (Poki, GameDistribution, Yandex Games, itch.io and so on). Covers the platform layer that isolates each portal's SDK (ads, saves, lifecycle signals, accounts, site mute) behind one interface chosen at build time, each portal's technical and ad rules, the submission form field by field, launch metrics and payouts. Use when building for a portal, adding an SDK or ads, adding a new portal to a game, submitting a game or a new version, reading launch metrics, or when the user names a game portal.
---

# Web game portals

**Default portal: CrazyGames.** When the user names no portal, work to CrazyGames' rules. When they name another one, read its reference here if there is one; if not, research it first (`references/new-portal.md`) and write the reference before writing code.

| Reference | Read when |
| --- | --- |
| `references/crazygames.md` | Anything for CrazyGames: requirements, ads, the form, QA tool, metrics, payouts. |
| `references/y8.md`, `references/gamepix.md` | Those portals. |
| `references/other-portals.md` | Choosing where to publish; portals with no adapter yet. |
| `references/new-portal.md` | **A portal not listed above**: how to research it and add it. |

Portal rules change. Before a submission, re-read the portal's live requirement pages and compare them with the reference; update the reference in this repo when they differ.

## The platform layer

Game code never calls a portal SDK or `localStorage`. It talks to one object, `platform` (`src/platform/index.js`), and the portal is chosen at build time by `VITE_PLATFORM`; the other adapters are dropped from the bundle.

```sh
P=~/.claude/skills/web-game-portals
$P/init.sh mygame_ crazygames        # once: src/platform/ + build:crazygames (the prefix is the game's storage-key prefix)
$P/add-platform.sh y8                # a portal this skill knows: its tested adapter
$P/add-platform.sh poki PokiSDK      # any other portal: a skeleton to fill after research
npm run build:crazygames             # -> dist-crazygames
```

These files are copied into the project on purpose: they ship with the game. `init.sh` and `add-platform.sh` never overwrite a file.

| `platform.` | Meaning |
| --- | --- |
| `init()` | Loads the portal's adapter. Never throws; falls back to the web platform after a 4 s timeout. |
| `loadingStart()` / `loadingStop()` | Around the first load. `loadingStop` when the first playable screen is ready. |
| `gameplayStart()` / `gameplayStop()` | Around real play (not menus, not pause). Repeats are ignored. |
| `midgameAd()` | An ad at a natural break. Resolves when the game may continue, whatever happened. |
| `rewardedAd()` | Resolves `true` only when the whole ad was watched. |
| `canShowAds` | Hide ad buttons when false (adblock, no SDK, web build). |
| `onAdStart(fn)` / `onAdEnd(fn)` | Pause the simulation, block input, mute. Called only when an ad is really on screen. |
| `storage` | `getItem` / `setItem` / `removeItem`: the portal's cloud save when it has one, safe local storage otherwise. |
| `username()` | The signed-in portal name, or null. |
| `onMute(cb)` | The site's mute button: `cb(true)` must silence the game. |
| `happytime()` | A moment worth celebrating. |
| `extra(name, ...args)` | Portal-specific calls (invite links, rooms). Undefined when the portal has none. |

A method an adapter leaves out is answered by the web platform, so a call can never throw: one missing method once froze a game at its first boss.

### Wire the game

1. `vite.config.js`: `base: "./"`, `plugins: [platformHtml()]`, `build: { ...platformBuild() }` from `./src/platform/vite.js` (SDK tags in `<head>` for portals that need them, no source maps in portal builds).
2. Boot: `await platform.init(); platform.loadingStart();` then `platform.loadingStop()` when the first screen is ready.
3. Replace every `localStorage` call in game code with `platform.storage`. Fill `savePrefix` in `src/platform/config.js`.
4. `gameplayStart()` when a run begins or resumes; `gameplayStop()` on pause, death, menu.
5. `platform.onAdStart(() => game.pauseForAd())`, `platform.onAdEnd(() => game.resumeFromAd())`, `platform.onMute((m) => audio.setSiteMuted(m))`.
6. Ads only where the rules allow (below). Test locally with `?simads` on the web build.
7. Add to the project's quality gate: `grep -rnE "localStorage|CrazyGames|GamePix|y8Sdk" src --include='*.js' | grep -v '^src/platform/'` prints nothing.
8. Test with the fake SDK: `web-game-qa` (`init.sh --sdk`, suite `sdk.crazygames`).

## Rules that hold on every portal

- **Play starts at once.** No lobby, account wall or "rotate your phone" screen before play; one click at most. Load time is measured up to the first gameplay signal.
- **Budget:** first download under 20 MB, playable in under 10 s, smooth on a 4 GB Chromebook, relative paths only, works inside an iframe.
- **Ads never interrupt play.** Midgame ads at natural breaks only (level end, after death, restart), never from a menu button. Rewarded ads are the player's choice, marked with a video icon, with a same-size "no thanks", and the reward only when the SDK confirms a full view. Never a midgame and a rewarded ad on the same screen.
- **Adblock:** never block or punish. Hide the ad buttons.
- **Only the portal's ads and login.** No external ad networks, no external sign-in, no links out.
- **The site's controls win:** its mute button silences the game; its pause pauses it.
- **Saves go through the SDK** when the portal has cloud saves.
- **English default**, and the first minute must show what to do without reading.

## Publishing, step by step

1. Choose the portal and re-read its live rules. Order that worked: CrazyGames Basic Launch first (open to everyone, real metrics in days), then the others.
2. Platform layer in, fake-SDK suite green, devices suite green (`web-game-qa`).
3. Store kit ready and checked (`web-game-store-assets`): covers, preview videos (`web-game-trailer`), listing.
4. `package.sh <portal>` and upload as the portal wants (CrazyGames: the folder, not the zip).
5. Fill the form from `docs/store/LISTING.md`; write every value and every surprise into `docs/store/SUBMISSIONS.md` as you go.
6. Run the portal's own QA tool in one session; fix and re-upload before submitting.
7. After launch: read the metrics per device every day, change one thing at a time, and space updates out so their effect can be told apart.
8. **Payout details:** before the owner types anything into a payment form, confirm every field with the bank or payment service (name spelling, account currency, SWIFT code, address on the statement, fees). Never guess a banking field, and never say a field can be changed later without having checked.

## Keeping this skill current

After each submission, move what was learned from the project's `SUBMISSIONS.md` into the portal's reference here (new form fields, rule changes, rejections and their reasons, real numbers), and commit.
