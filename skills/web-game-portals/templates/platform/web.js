/** localStorage that cannot throw: private windows and blocked storage fall back to memory. */
export function safeStorage() {
  try {
    const s = window.localStorage;
    const probe = "__storage_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
}

/** A stand-in ad for local testing, shown only with `?simads` in the URL. */
function simulatedAd(label, ms) {
  return new Promise((resolve) => {
    const box = document.createElement("div");
    box.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;background:rgba(0,0,0,.92);color:#fff;font:600 20px system-ui";
    const text = document.createElement("div");
    text.textContent = `Simulated ${label} ad`;
    const skip = document.createElement("button");
    skip.textContent = "Close without reward";
    skip.style.cssText = "font:inherit;padding:8px 16px";
    box.append(text, skip);
    document.body.append(box);
    let done = false;
    const finish = (watched) => {
      if (done) return;
      done = true;
      box.remove();
      resolve(watched);
    };
    skip.addEventListener("click", () => finish(false));
    setTimeout(() => finish(true), ms);
  });
}

/** The plain web build (own site, itch.io, local dev): no ads, local saves. Also the base of every adapter. */
export function createWebPlatform(hooks = {}) {
  let storage = null;
  const simulate = typeof location !== "undefined" && new URLSearchParams(location.search).has("simads");
  const ad = async (label) => {
    if (!simulate) return false;
    hooks.adStart?.();
    const watched = await simulatedAd(label, 1500);
    hooks.adEnd?.();
    return watched;
  };
  return {
    name: "web",
    canShowAds: simulate,
    async init() {
      return true;
    },
    get storage() {
      return (storage ??= safeStorage());
    },
    loadingStart() {},
    loadingStop() {},
    gameplayStart() {},
    gameplayStop() {},
    happytime() {},
    async midgameAd() {
      await ad("midgame");
    },
    rewardedAd: () => ad("rewarded"),
    async username() {
      return null;
    },
    onMute() {},
  };
}
