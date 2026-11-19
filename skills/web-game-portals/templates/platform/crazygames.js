import { safeStorage } from "./web.js";
import { PLATFORM_CONFIG } from "./config.js";

const SDK_URL = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
const INIT_TIMEOUT = 4000;
const AD_START_TIMEOUT = 8000; // no ad on screen by then: give up, so a button never hangs
// Ad errors that mean "no ads at all this session" (the others, like unfilled or adCooldown, are per request).
const ADS_OFF = new Set(["adsDisabled", "adblock"]);

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("CrazyGames SDK failed to load"));
    document.head.appendChild(s);
  });

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

/**
 * CrazyGames SDK v3 (https://docs.crazygames.com/sdk/intro/). `hooks.adStart/adEnd` let the game pause and
 * mute around ads; `deps` lets tests hand in a fake SDK. Every SDK call is wrapped: the SDK throws in the
 * `disabled` environment and the game must never break.
 */
export default function createCrazyGamesPlatform(hooks = {}, deps = {}) {
  const getSdk = deps.getSdk ?? (() => globalThis.window?.CrazyGames?.SDK);
  const load = deps.loadScript ?? loadScript;
  const timeout = deps.timeout ?? INIT_TIMEOUT;
  const fallback = safeStorage();
  let sdk = null;
  let playing = false;
  const guard = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };

  /** SDK Data module (synced with the player's account), falling back to local storage if it throws. */
  const storage = {
    getItem: (k) => {
      try {
        return sdk.data.getItem(k);
      } catch {
        return fallback.getItem(k);
      }
    },
    setItem: (k, v) => {
      try {
        sdk.data.setItem(k, String(v));
      } catch {
        fallback.setItem(k, v);
      }
    },
    removeItem: (k) => {
      try {
        sdk.data.removeItem(k);
      } catch {
        fallback.removeItem(k);
      }
    },
  };

  /** A player who saved before the SDK existed keeps their progress: copy it into the account once. */
  const migrate = () => {
    const ls = deps.localStorage ?? guard(() => globalThis.localStorage);
    const prefix = PLATFORM_CONFIG.savePrefix;
    if (!ls || !prefix) return;
    guard(() => {
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k?.startsWith(prefix) && (sdk.data.getItem(k) ?? null) === null) sdk.data.setItem(k, ls.getItem(k));
      }
    });
  };

  const requestAd = (type) =>
    new Promise((resolve) => {
      let settled = false;
      let started = false;
      let waiting = 0;
      const end = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(waiting);
        if (started) hooks.adEnd?.(); // adEnd pairs with adStart: a request that never showed resumes nothing
        resolve(ok);
      };
      if (!api.canShowAds) return resolve(false);
      waiting = setTimeout(() => end(false), deps.adTimeout ?? AD_START_TIMEOUT);
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => {
            // An ad that starts after this request gave up is not paused for: pausing now would never be
            // undone, because adEnd only fires for an open request (the game would stay frozen and muted).
            if (settled || started) return;
            started = true;
            clearTimeout(waiting);
            hooks.adStart?.(); // pause and mute only now: a request that never fills must not silence the game
          },
          adFinished: () => end(true),
          adError: (e) => {
            if (ADS_OFF.has(e?.code)) api.canShowAds = false;
            end(false);
          },
        });
      } catch {
        end(false);
      }
    });

  const api = {
    name: "crazygames",
    canShowAds: false,
    storage,

    /** True when the SDK is usable; false (never throws) when the game should stay on the web platform. */
    async init() {
      try {
        if (!getSdk()) await withTimeout(load(SDK_URL), timeout);
        sdk = getSdk();
        if (!sdk) return false;
        await withTimeout(sdk.init(), timeout);
        if (sdk.environment === "disabled") return false;
        migrate();
        api.canShowAds = !(await guard(() => sdk.ad.hasAdblock()));
        return true;
      } catch {
        sdk = null;
        return false;
      }
    },

    loadingStart: () => guard(() => sdk.game.loadingStart()),
    loadingStop: () => guard(() => sdk.game.loadingStop()),
    /** The SDK wants one start per play session: repeated calls are dropped here. */
    gameplayStart() {
      if (playing) return;
      playing = true;
      guard(() => sdk.game.gameplayStart());
    },
    gameplayStop() {
      if (!playing) return;
      playing = false;
      guard(() => sdk.game.gameplayStop());
    },
    happytime: () => guard(() => sdk.game.happytime()),

    async midgameAd() {
      await requestAd("midgame");
    },
    rewardedAd: () => requestAd("rewarded"),

    /** The logged-in CrazyGames username, or null. Multiplayer games must show it in-game. */
    async username() {
      try {
        if (!sdk?.user?.isUserAccountAvailable) return null;
        return (await sdk.user.getUser())?.username ?? null;
      } catch {
        return null;
      }
    },
    /** The site's mute setting wins over the in-game volume. */
    onMute(cb) {
      guard(() => cb(!!sdk.game.settings.muteAudio));
      guard(() => sdk.game.addSettingsChangeListener((s) => cb(!!s.muteAudio)));
    },

    // Multiplayer extras, reached through platform.extra(name, ...).
    inviteLink: (code) => guard(() => sdk.game.inviteLink({ room: code })) ?? `${location.origin}${location.pathname}?room=${code}`,
    roomFromUrl: () =>
      guard(() => sdk.game.getInviteParam("room") || sdk.game.getInviteParam("roomName")) ||
      new URLSearchParams(location.search).get("room") ||
      "",
    /** A friend's invite accepted while the game is already open. */
    onJoinRoom: (cb) => guard(() => sdk.game.addJoinRoomListener((p) => cb(p?.room ?? p?.roomName ?? ""))),
    roomOpen: (code) => guard(() => sdk.game.updateRoom({ roomId: code, isJoinable: true, inviteParams: { room: code } })),
    roomLeft: () => guard(() => sdk.game.leftRoom()),
    /** Logging in mid-session (the SDK reloads the page on logout). */
    onLogin: (cb) => guard(() => sdk.user.addAuthListener((user) => user?.username && cb(user.username))),
    /** Opened from a friend's party: go straight into a private room. */
    isInstantMultiplayer: () => !!guard(() => sdk.game.isInstantMultiplayer),
  };
  return api;
}
