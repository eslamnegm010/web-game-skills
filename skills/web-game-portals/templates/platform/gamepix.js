import { createWebPlatform } from "./web.js";

/**
 * GamePix SDK v3 (https://partners.gamepix.com/sdk/doc/javascript), manual lifecycle. The script tag and
 * `GamePixConfig` go first in <head> (see vite.js) because the SDK syncs localStorage, so saves stay on the
 * web storage. Every call is guarded so the SDK can never break the game.
 */
export default function createGamePixPlatform(hooks = {}, deps = {}) {
  const getSdk = deps.getSdk ?? (() => globalThis.window?.GamePix);
  const web = createWebPlatform();
  let sdk = null;
  let ready = null;
  let started = false;
  let adBusy = false;
  const guard = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };

  const showAd = async (kind) => {
    if (!sdk || adBusy) return false;
    adBusy = true;
    try {
      await ready;
      const res = await sdk.ads[kind]();
      return !!res?.success;
    } catch {
      return false;
    } finally {
      adBusy = false;
    }
  };

  return {
    ...web,
    name: "gamepix",
    canShowAds: false,

    async init() {
      sdk = guard(getSdk) ?? null;
      if (!sdk) return false;
      // Mandatory: the site pauses the game (ads and more). The game's ad hooks stop input and mute.
      guard(() => sdk.events.on("pause", () => hooks.adStart?.()));
      guard(() => sdk.events.on("resume", () => hooks.adEnd?.()));
      this.canShowAds = true;
      return true;
    },

    loadingStart: () => guard(() => sdk.lifecycle.loading(0)),
    loadingStop() {
      ready ??= guard(() => sdk.lifecycle.loaded()) ?? Promise.resolve();
    },
    gameplayStart() {
      if (started) return;
      started = true;
      guard(() => sdk.lifecycle.gameStart());
    },
    gameplayStop() {},

    async midgameAd() {
      await showAd("interstitial");
    },
    rewardedAd: () => showAd("reward"),
  };
}
