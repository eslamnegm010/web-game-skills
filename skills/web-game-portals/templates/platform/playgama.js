import { safeStorage } from "./web.js";
import { PLATFORM_CONFIG } from "./config.js";

/** Bridge reports ISO 639-1; regional values ("pt-BR") trim to the primary subtag. */
const mapPlatformLang = (raw) => {
  const code = String(raw ?? "")
    .toLowerCase()
    .split(/[-_]/)[0];
  return code || null;
};

const INIT_TIMEOUT = 10000;
const STORAGE_TIMEOUT = 5000;
const AD_START_TIMEOUT = 8000; // no ad on screen by then: give up, so a button never hangs

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);

/**
 * Playgama Bridge SDK v2 (https://wiki.playgama.com/playgama/bridge-sdk/). The bridge script is injected
 * first in <head> at build time (see vite.js) together with playgama-bridge-config.json, which carries
 * the advertisement settings — there is no credential in config.js for this portal: the cabinet
 * identifies the game from its hosting context. `hooks.adStart/adEnd` let the game pause and mute;
 * `deps` lets tests hand in a fake bridge. Every call is guarded: a missing or blocked bridge declines
 * init() and the game stays on the web platform.
 *
 * Storage is the awkward one: the facade's storage is synchronous, Bridge's is promise-based. Bridge
 * storage is the save backend on this portal — init() (awaited before the game boots) restores the
 * cloud copy into the local cache before the game's first read, every write is mirrored up, and
 * local-only saves (written before the SDK existed, or on the web build) are pushed up once, the
 * one-time migration. Local storage is never the only durable copy when the bridge is present; it
 * is the synchronous cache the facade's shape requires, the same pattern as the CrazyGames adapter.
 */
export default function createPlaygamaPlatform(hooks = {}, deps = {}) {
  const getBridge = deps.getBridge ?? (() => globalThis.window?.bridge);
  const timeout = deps.timeout ?? INIT_TIMEOUT;
  const prefix = PLATFORM_CONFIG.savePrefix;
  const indexKey = `${prefix}__keys__`;
  const fallback = safeStorage();
  const knownKeys = new Set();
  let bridge = null;
  let platformLang = null;
  const guard = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };
  const send = (message) =>
    guard(() => {
      const p = bridge.platform.sendMessage(message);
      if (p?.catch) p.catch(() => {});
    });

  // Bridge storage parses on read: a stored JSON save comes back as an object,
  // a numeric string as a number, the key index as an array — never as the raw
  // strings that were set. asStored() converts a cloud value back to the
  // stored-string form the game's cache speaks; without it every JSON save
  // would restore as "[object Object]" and the game would reset every session.
  const asStored = (value) => {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : JSON.stringify(value);
  };
  // The Bridge also treats local storage as its own staging area and can drop
  // keys mid-session, so reads are served from this session mirror first; the
  // local cache and the cloud copy stay in step behind it.
  const mirror = new Map();
  const storage = {
    getItem: (k) => (mirror.has(k) ? mirror.get(k) : fallback.getItem(k)),
    setItem: (k, v) => {
      const s = String(v);
      mirror.set(k, s);
      fallback.setItem(k, s);
      if (!bridge) return;
      const isNew = k !== indexKey && !knownKeys.has(k);
      if (isNew) knownKeys.add(k);
      guard(() => {
        // A first-seen key rides in the same call as the updated index, so the cloud index can
        // never describe a key list that predates the write it belongs to.
        const p = isNew
          ? bridge.storage.set(
              [k, indexKey],
              [s, JSON.stringify([...knownKeys])],
            )
          : bridge.storage.set([k], [s]);
        if (p?.catch) p.catch(() => {});
      });
    },
    removeItem: (k) => {
      mirror.delete(k);
      fallback.removeItem(k);
      if (!bridge) return;
      guard(() => {
        const p = bridge.storage.delete([k]);
        if (p?.catch) p.catch(() => {});
      });
      // Keep the cloud index honest, or a deleted key would be offered for restore next launch.
      if (knownKeys.delete(k))
        guard(() => {
          const p = bridge.storage.set(
            [indexKey],
            [JSON.stringify([...knownKeys])],
          );
          if (p?.catch) p.catch(() => {});
        });
    },
  };

  /**
   * Restore the cloud saves into the local cache before the game reads them, in one get() for the
   * index plus every locally-known key (the docs' startup shape). A key only the cloud index
   * names — a save from another device — costs one extra get(). Local-only saves are pushed up
   * in a single batched set(): the one-time migration of saves written before the SDK existed.
   */
  const syncStorage = async () => {
    const ls = deps.localStorage ?? guard(() => globalThis.localStorage);
    if (ls) {
      guard(() => {
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k?.startsWith(prefix) && k !== indexKey) knownKeys.add(k);
        }
      });
    }
    const localKeys = [...knownKeys];
    const first = await withTimeout(
      Promise.resolve(bridge.storage.get([indexKey, ...localKeys])),
      STORAGE_TIMEOUT,
    );
    const cloud = new Map(
      localKeys.map((k, i) => [k, asStored(first?.[i + 1])]),
    );
    const unseen = [];
    // The index comes back as an array (parsed on read) or, from a store that
    // kept it raw, as its JSON string — accept both; a corrupt index only
    // costs the cloud-only restore, never the boot.
    let cloudKeys = first?.[0];
    if (typeof cloudKeys === "string") {
      try {
        cloudKeys = JSON.parse(cloudKeys);
      } catch {
        cloudKeys = null;
      }
    }
    if (Array.isArray(cloudKeys)) {
      for (const k of cloudKeys) {
        if (typeof k === "string" && !knownKeys.has(k)) {
          knownKeys.add(k);
          unseen.push(k);
        }
      }
    }
    if (unseen.length) {
      const more = await withTimeout(
        Promise.resolve(bridge.storage.get(unseen)),
        STORAGE_TIMEOUT,
      );
      unseen.forEach((k, i) => cloud.set(k, asStored(more?.[i])));
    }
    if (!knownKeys.size) return;
    const pushKeys = [];
    const pushValues = [];
    for (const k of knownKeys) {
      const value = cloud.get(k);
      if (value !== null && value !== undefined) {
        mirror.set(k, value);
        fallback.setItem(k, value);
      } else {
        const local = fallback.getItem(k);
        if (local !== null) {
          mirror.set(k, local);
          pushKeys.push(k);
          pushValues.push(local);
        }
      }
    }
    pushKeys.push(indexKey);
    pushValues.push(JSON.stringify([...knownKeys]));
    guard(() => {
      const p = bridge.storage.set(pushKeys, pushValues);
      if (p?.catch) p.catch(() => {});
    });
  };

  /**
   * One ad, resolved by its state changes (loading/opened/closed/rewarded/failed). The state is also
   * polled: an event subscription that silently failed must not hang the game.
   */
  const requestAd = (kind) =>
    new Promise((resolve) => {
      const adv = bridge?.advertisement;
      if (!api.canShowAds || !adv) return resolve(false);
      const isRewarded = kind === "rewarded";
      // A kind this platform does not support resolves at once: the player must never sit on a
      // button whose ad can never open (the docs' "hide what the platform does not support").
      if (isRewarded ? !adv.isRewardedSupported : !adv.isInterstitialSupported)
        return resolve(false);
      const stateProp = isRewarded ? "rewardedState" : "interstitialState";
      const eventName =
        bridge.EVENT_NAME?.[
          isRewarded ? "REWARDED_STATE_CHANGED" : "INTERSTITIAL_STATE_CHANGED"
        ] ??
        (isRewarded ? "rewarded_state_changed" : "interstitial_state_changed");
      let settled = false;
      let active = false;
      let rewarded = false;
      let polled = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(startTimer);
        clearInterval(poll);
        guard(() => adv.off?.(eventName, onState));
        resolve(isRewarded ? rewarded : undefined);
      };
      const onState = (state, fromPoll = false) => {
        if (state === "loading" || state === "opened") {
          active = true;
          clearTimeout(startTimer);
        } else if (state === "rewarded") {
          // Only a "rewarded" that belongs to this request counts. An event is
          // a transition, so it must follow this request's own loading/opened;
          // the poll must watch a change into "rewarded" — a value already
          // latched at the first poll is the previous ad's leftover and would
          // grant a reward for an ad the player never watched.
          if (active || (fromPoll && polled !== null && polled !== "rewarded"))
            rewarded = true;
        } else if ((state === "closed" || state === "failed") && active) {
          finish();
        }
        if (fromPoll) polled = state;
      };
      const startTimer = setTimeout(() => {
        if (!active) finish();
      }, deps.adTimeout ?? AD_START_TIMEOUT);
      const poll = setInterval(() => {
        const s = guard(() => adv[stateProp]);
        if (s) onState(s, true);
      }, 250);
      guard(() => adv.on(eventName, onState));
      try {
        if (isRewarded) adv.showRewarded();
        else adv.showInterstitial();
      } catch {
        finish();
      }
    });

  const api = {
    name: "playgama",
    canShowAds: false,
    storage,

    /** True when the bridge initialised; false (never throws) when the game should stay on web. */
    async init() {
      try {
        bridge = getBridge();
        if (!bridge || typeof bridge.initialize !== "function") {
          bridge = null;
          return false;
        }
        await withTimeout(Promise.resolve(bridge.initialize()), timeout);
        // Read once, right after initialization (the docs' order): on a first boot the game's
        // locale comes from the platform when the player has no saved choice yet.
        platformLang = mapPlatformLang(guard(() => bridge.platform.language));
        // Cloud saves land before the facade swaps this adapter in, so the game's first read sees them.
        await syncStorage().catch(() => {});
        api.canShowAds = !!(
          bridge.advertisement?.isInterstitialSupported ||
          bridge.advertisement?.isRewardedSupported
        );
        // The platform pause signal covers ads, tab switches and minimising alike: it maps exactly
        // onto the game's pause + mute / resume hooks (Bridge's own recommendation over per-ad logic).
        const pauseEvent =
          bridge.EVENT_NAME?.PAUSE_STATE_CHANGED ?? "pause_state_changed";
        guard(() =>
          bridge.platform.on(pauseEvent, (isPaused) => {
            if (isPaused) hooks.adStart?.();
            else hooks.adEnd?.();
          }),
        );
        return true;
      } catch {
        bridge = null;
        return false;
      }
    },

    loadingStart: () => send("in_game_loading_started"),
    /** game_ready is the required signal: the first playable frame is up and loading screens are gone. */
    loadingStop: () => send("game_ready"),
    gameplayStart: () => send("level_started"),
    gameplayStop: () => send("level_paused"),
    happytime: () => send("player_got_achievement"),

    async midgameAd() {
      await requestAd("interstitial");
    },
    /** The reward is granted only when the final state was "rewarded" (Bridge's own rule). */
    rewardedAd: () => requestAd("rewarded"),

    /** The platform's language (ISO 639-1 primary subtag), or null. Captured at init, before boot. */
    preferredLanguage: () => platformLang,

    /** The signed-in player's name, or null. */
    async username() {
      try {
        return bridge?.player?.name ?? null;
      } catch {
        return null;
      }
    },
    /** The platform's audio switch wins over the in-game volume. */
    onMute(cb) {
      if (!bridge) return;
      guard(() => cb(!bridge.platform.isAudioEnabled));
      const audioEvent =
        bridge.EVENT_NAME?.AUDIO_STATE_CHANGED ?? "audio_state_changed";
      guard(() =>
        bridge.platform.on(audioEvent, (enabled) =>
          cb(
            typeof enabled === "boolean"
              ? !enabled
              : !bridge.platform.isAudioEnabled,
          ),
        ),
      );
    },
  };
  return api;
}
