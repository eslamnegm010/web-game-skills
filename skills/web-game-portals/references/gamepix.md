# GamePix

Official: https://partners.gamepix.com/sdk/doc/javascript (SDK v3) and the partner dashboard. Notes from a hands-on integration and upload. Re-read the docs before relying on any detail.

## SDK (v3, manual lifecycle)

- **The SDK goes first in `<head>`**, before any other script, because it syncs `localStorage` (saves therefore stay on normal local storage):
  ```html
  <script>window.GamePixConfig = { lifecycle: "manual" };</script>
  <script src="https://integration.gamepix.com/sdk/v3/gamepix.sdk.js"></script>
  ```
- Lifecycle: `GamePix.lifecycle.loading(0)` at start, `await GamePix.lifecycle.loaded()` when the first screen is ready, `GamePix.lifecycle.gameStart()` once when play begins.
- **Mandatory events:** `GamePix.events.on('pause', ...)` and `('resume', ...)`: the site pauses the game for ads and for its own reasons. Stop input and sound on pause.
- Ads: `await GamePix.ads.interstitial()` and `await GamePix.ads.reward()`, each resolving `{ success }`. Wait for `loaded()` before the first ad. Reward only on `success`.

## Rules that needed code changes

- **Relative paths only, nothing from other domains**: fonts loaded from a CDN had to be bundled (`@fontsource/...` packages) and the font `<link>` tags removed for this build. `platformHtml()` strips Google Fonts links; bundle the fonts.
- **No "rotate your device" prompts.** Remove them in this build.

The adapter is `templates/platform/gamepix.js`. There is no fake SDK for GamePix in `web-game-qa` yet: test in the dashboard's preview.

## Submission

Upload the `dist-gamepix` build as a zip (`package.sh gamepix`) in the partner dashboard, fill the listing, submit for review.
