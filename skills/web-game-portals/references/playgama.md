# Playgama

Official: the developer cabinet at https://playgama.com and the Bridge SDK wiki at https://wiki.playgama.com/playgama/bridge-sdk/. Notes from hands-on integration work. Re-read the wiki before relying on any detail.

## The road in

1. **Cabinet → add the game → upload the build.** The game is identified from its hosting context: there is no game id or credential in the code or in `config.js`. The per-platform ids live in `playgama-bridge-config.json` (below), which the cabinet completes at submission.
2. **Basic Certification**: an automated pass over the build. It really exercises the integration — ad calls are made, storage is written and read back — so a build whose ads or saves only work in a human's careful playthrough can still fail here.
3. **Sandbox**: the game goes live to real players through the cabinet's "Test with players" link, for a **30-day** window. Targets to unlock the main-catalog review: **100 qualifying plays, 5:00 average play time, 0.30 ad shows per play**.
4. **Review → Main Catalog** once the targets are met. New builds go up with **Update in Sandbox**; the window and targets keep running.

## SDK (Bridge v2)

- **The bridge script goes first in `<head>`**: `<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>` (the vite template injects it), then `await bridge.initialize()` before the game boots. The global is `window.bridge`.
- **`playgama-bridge-config.json` must sit next to `index.html`** in the build, or the bridge refuses the build. The vite template emits it at build time for the playgama target; it carries the advertisement settings (for example `minimumDelayBetweenInterstitial: 60`).
- **Lifecycle signals** go through `bridge.platform.sendMessage(...)`:

  | Facade | Bridge message |
  | --- | --- |
  | `loadingStart()` | `in_game_loading_started` |
  | `loadingStop()` | `game_ready` — **required**: the first playable frame is up and loading screens are gone |
  | `gameplayStart()` | `level_started` |
  | `gameplayStop()` | `level_paused` |
  | `happytime()` | `player_got_achievement` |

- **Language**: read `bridge.platform.language` once, right after initialization (the docs' order). It reports ISO 639-1, sometimes regional (`pt-BR`) — trim to the primary subtag and map it to a shipped locale.
- **Player**: `bridge.player.name` is the signed-in player's name.
- **Site audio**: `bridge.platform.isAudioEnabled` plus the `audio_state_changed` event. The platform's switch wins over the in-game volume.

## Storage — the trap that costs a launch day

Bridge storage is cloud storage behind a promise API (`bridge.storage.get/set/delete` with key and value arrays), and it does **not** behave like `localStorage`:

- **`get()` returns JSON-parsed values, never the raw strings that were set.** A stored JSON save comes back as an object, a numeric string as a number, an array as an array. An adapter that caches `String(value)` corrupts every JSON save into `"[object Object]"` on restore — the game then resets every session while looking fine in short tests. Normalize on read: strings pass through, everything else is `JSON.stringify`-ed back to the stored-string form.
- **The Bridge treats `localStorage` as its own staging area** and deletes its managed keys from it, so the raw local copy is not durable and can lose keys mid-session. Serve reads from an in-adapter session mirror; the cloud copy is the durable one.
- **Writes flush late** — seconds, inside the Bridge. Never read back from the cloud in the same session to confirm a write; the mirror is the truth until the next launch.
- The adapter's shape (in `templates/platform/playgama.js`): restore the cloud copy into the local cache during `init()`, before the game's first read; keep a key index (`<prefix>__keys__`) because there is no "list keys" call; a first-seen key rides in the same `set()` as its updated index; local-only saves (written before the SDK existed, or on the web build) are pushed up once — the one-time migration; deletes update the index in the same breath.

## Ads

- The `bridge.advertisement` module is a **state machine**, not a callback pair: states `loading / opened / closed / rewarded / failed` on `interstitialState` / `rewardedState`, with the events `interstitial_state_changed` / `rewarded_state_changed` (prefer the `bridge.EVENT_NAME` constants when present).
- **Support is per kind**: `isInterstitialSupported` / `isRewardedSupported`. Hide what the platform does not support — a button whose ad can never open must not exist (the docs say the same).
- **Reward rule (Bridge's own): grant only on a `rewarded` state that belongs to this request.** The state can sit latched at `rewarded` from the *previous* ad: a poll that reads it at face value pays a reward for an ad the player never watched. Count it only after this request's own `loading/opened`, or when the polled value *changes into* `rewarded`.
- **Poll the state as well as listening** (the adapter uses 250 ms). An event subscription that silently failed must not hang the game on an ad that already closed. And give up cleanly when no ad opens within a few seconds: a button must never hang.
- **Pause**: the platform's `pause_state_changed` event covers ads, tab switches and minimising alike. Map it onto the game's pause + mute / resume hooks — Bridge's own recommendation, simpler and safer than per-ad pause logic.
- **Pointer lock**: if the game holds the pointer lock (any first-person game), release it when an ad starts, or the player is left locked against the ad and the returning game.

## Certification findings

- The automated certification can report a **rewarded-ad finding that is a false positive**. Proven against the real Bridge in a local host rig: closing a rewarded ad early never yields `rewarded` and the game correctly never pays out; watching to completion yields `rewarded` and the game revives and pays. The suspected cause is the Bridge's delayed storage flush — inside the Bridge, not fixable from game code. Verify in a local rig before changing game code for a finding, and describe the result to Playgama's support rather than changing correct reward logic.
- There is no fake Bridge in `web-game-qa` yet: test with the real bridge script in a local host page, and in the cabinet's preview.

## Sandbox metrics — honestly earned only

Never generate plays with bots, scripts or agent farms to hit the Sandbox targets: fabricated plays risk disqualification and the account. Grow with the "Test with players" link and the free Sandbox Boosts the cabinet offers.

The adapter is `templates/platform/playgama.js`.
