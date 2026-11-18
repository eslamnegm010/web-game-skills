import { createWebPlatform } from "./web.js";
import { PLATFORM_CONFIG } from "./config.js";

/**
 * Y8 Minimal SDK v2.0 (https://docs.y8.com/sdk/intro/): interstitial and rewarded ads, Y8 account.
 * The SDK script and its init live in <head> (see vite.js); this adapter waits for `window.y8Sdk`.
 * Every call is guarded so a missing SDK or an ad error never breaks the game.
 */
export default function createY8Platform(hooks = {}, deps = {}) {
  const web = createWebPlatform();
  let sdk = null;
  let user = null;
  let adBusy = false;

  const showAd = (options, result) =>
    new Promise((resolve) => {
      if (!sdk || adBusy) return resolve(false);
      adBusy = true;
      let started = false;
      const done = (ok) => {
        if (!adBusy) return;
        adBusy = false;
        if (started) hooks.adEnd?.();
        resolve(ok);
      };
      try {
        sdk
          .showAd({
            ...options,
            beforeAd: () => {
              started = true;
              hooks.adStart?.();
            },
            adBreakDone: () => done(result()),
          })
          ?.catch?.(() => done(false));
      } catch {
        done(false);
      }
    });

  return {
    ...web,
    name: "y8",
    canShowAds: false,

    async init() {
      const { appId, gameId } = PLATFORM_CONFIG.y8 ?? {};
      if (!deps.sdk && (!appId || !gameId)) return false; // ids come from the Y8 developer dashboard
      return new Promise((resolve) => {
        const ready = () => {
          sdk = deps.sdk ?? globalThis.window?.y8Sdk ?? null;
          if (!sdk) return false;
          try {
            sdk.onAuth?.((u, error) => {
              if (u && !error) user = u;
            });
          } catch {
            // accounts are optional
          }
          this.canShowAds = true;
          resolve(true);
          return true;
        };
        if (ready()) return;
        const t0 = Date.now();
        const poll = setInterval(() => {
          if (ready()) clearInterval(poll);
          else if (Date.now() - t0 > (deps.initTimeout ?? 4000)) {
            clearInterval(poll);
            resolve(false);
          }
        }, 100);
      });
    },

    async username() {
      return user?.displayName ?? user?.userName ?? null;
    },

    async midgameAd() {
      await showAd({ type: "next", name: "level-complete" }, () => true);
    },
    rewardedAd() {
      let viewed = false;
      return showAd(
        {
          type: "reward",
          name: "reward",
          beforeReward: (show) => typeof show === "function" && show(),
          adDismissed: () => (viewed = false),
          adViewed: () => (viewed = true),
        },
        () => viewed,
      );
    },
  };
}
