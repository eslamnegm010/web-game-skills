import { createWebPlatform } from "./web.js";

/**
 * __NAME__ adapter. SDK docs: <paste the URL of the official docs you read, and the date>.
 * Start from the web platform and replace only what this portal provides. Rules that hold for every portal:
 *  - init() resolves true only when the SDK is usable, never throws, and gives up after a few seconds;
 *  - every SDK call is wrapped (guard): a portal SDK must never be able to break the game;
 *  - hooks.adStart() only when an ad is really on screen, hooks.adEnd() exactly once after it;
 *  - rewardedAd() resolves true only when the SDK confirms the whole ad was watched.
 */
export default function create__PASCAL__Platform(hooks = {}, deps = {}) {
  const getSdk = deps.getSdk ?? (() => globalThis.window?.__SDK_GLOBAL__);
  const web = createWebPlatform();
  let sdk = null;
  const guard = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };

  return {
    ...web,
    name: "__NAME__",
    canShowAds: false,

    async init() {
      sdk = guard(getSdk) ?? null;
      if (!sdk) return false;
      // TODO: initialise the SDK as its docs say, with a timeout.
      this.canShowAds = true;
      return true;
    },

    // TODO: map each signal the portal has; delete the ones it does not have (the web no-op answers).
    loadingStart: () => guard(() => {}),
    loadingStop: () => guard(() => {}),
    gameplayStart: () => guard(() => {}),
    gameplayStop: () => guard(() => {}),

    async midgameAd() {
      // TODO: hooks.adStart?.() when the ad opens, hooks.adEnd?.() when it closes or fails.
    },
    async rewardedAd() {
      // TODO: resolve true only on the SDK's "reward granted" signal.
      return false;
    },
  };
}
