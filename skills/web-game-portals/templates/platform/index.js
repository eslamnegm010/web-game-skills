import { createWebPlatform } from "./web.js";
import { PLATFORM_CONFIG } from "./config.js";

/** The longest a portal may hold up the boot. Each adapter also gives up on its own, sooner. */
const INIT_TIMEOUT = PLATFORM_CONFIG.initTimeout ?? 12000;

/**
 * The only door between the game and the site it runs on (ads, saves, lifecycle signals, accounts).
 * Game code imports `platform` from here and never touches localStorage or a portal SDK directly.
 * The portal is chosen at build time (`vite build --mode <portal>`, which platformHtml() in vite.js turns into
 * import.meta.env.VITE_PLATFORM); every other adapter is dropped from the bundle.
 */
const adStartFns = new Set();
const adEndFns = new Set();
const hooks = {
  adStart: () => adStartFns.forEach((f) => f()),
  adEnd: () => adEndFns.forEach((f) => f()),
};

async function loadAdapter() {
  const target = import.meta.env?.VITE_PLATFORM;
  // One line per portal, added by add-platform.sh. Keep the literal comparisons: the bundler removes the rest.
  // @platform-adapters
  return null;
}

let impl = createWebPlatform(hooks);
const web = impl;
/** A portal adapter may leave a method out: the web version answers instead, so a call can never throw. */
const call = (name, ...args) => (impl[name] ?? web[name])?.(...args);

export const platform = {
  get name() {
    return impl.name;
  },
  get canShowAds() {
    return !!impl.canShowAds;
  },
  get storage() {
    return impl.storage ?? web.storage;
  },

  /** Never throws. Falls back to the web platform when the SDK is missing, blocked or slow
   *  (PLATFORM_CONFIG.initTimeout, 12 s by default; the adapters give up sooner on their own). */
  async init() {
    let timer = 0;
    try {
      const create = await loadAdapter();
      const candidate = create?.(hooks);
      if (!candidate) return true;
      const ready = await Promise.race([
        Promise.resolve(candidate.init()).catch(() => false),
        new Promise((resolve) => (timer = setTimeout(() => resolve(false), INIT_TIMEOUT))),
      ]);
      if (ready) impl = candidate;
    } catch {
      // stay on the web platform
    } finally {
      clearTimeout(timer);
    }
    return true;
  },

  loadingStart: () => call("loadingStart"),
  loadingStop: () => call("loadingStop"),
  /** Call when real play begins and when it stops (menu, pause, death). Repeats are ignored by the adapters. */
  gameplayStart: () => call("gameplayStart"),
  gameplayStop: () => call("gameplayStop"),
  /** A moment worth celebrating (boss down, record beaten). */
  happytime: () => call("happytime"),

  /** An ad at a natural break. Resolves when the game may continue, whatever happened. */
  async midgameAd() {
    try {
      await call("midgameAd");
    } catch {
      // an ad must never stop the game
    }
  },
  /** Resolves true only when the player watched the whole ad. */
  async rewardedAd() {
    try {
      return !!(await call("rewardedAd"));
    } catch {
      return false;
    }
  },
  /** The signed-in portal username, or null. */
  async username() {
    try {
      return (await call("username")) ?? null;
    } catch {
      return null;
    }
  },
  /** The site's own mute button: cb(true) must silence the game. */
  onMute: (cb) => call("onMute", cb),

  /** Pause and mute while an ad is on screen. Returns an unsubscribe function. */
  onAdStart(fn) {
    adStartFns.add(fn);
    return () => adStartFns.delete(fn);
  },
  onAdEnd(fn) {
    adEndFns.add(fn);
    return () => adEndFns.delete(fn);
  },

  /** Portal-specific extras (invite links, rooms): `platform.extra("inviteLink", code)`. Undefined when absent. */
  extra: (name, ...args) => impl[name]?.(...args),
};
