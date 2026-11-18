// Build-time side of the platform layer. In vite.config.js:
//   import { platformHtml, platformBuild } from "./src/platform/vite.js";
//   export default defineConfig({ base: "./", plugins: [platformHtml()], build: { ...platformBuild() } });
import { PLATFORM_CONFIG } from "./config.js";

const target = process.env.VITE_PLATFORM ?? "";

/** What each portal needs in <head> before the game's own script. Portals that load their SDK at run time
 *  (CrazyGames) need nothing here. add-platform.sh adds an empty entry for a new portal. */
const HEAD = {
  gamepix: () => `
    <script>window.GamePixConfig = { lifecycle: "manual" };</script>
    <script src="https://integration.gamepix.com/sdk/v3/gamepix.sdk.js"></script>`,
  y8: () => `
    <script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async></script>
    <script>
      window.addEventListener("y8sdk.ready", function () {
        window.y8Sdk = y8.sdk();
        window.y8Sdk.init(
          { appId: ${JSON.stringify(PLATFORM_CONFIG.y8?.appId ?? "")}, autoLogin: true },
          { gameId: ${JSON.stringify(PLATFORM_CONFIG.y8?.gameId ?? "")}, preloadAdBreaks: "on", sound: "on", onReady: function () {} }
        );
      }, { once: true });
      if (window.y8 && window.y8.emitReadyEvent) window.y8.emitReadyEvent();
    </script>`,
  // @platform-head
};

/** Injects the portal's SDK tags first in <head>, and drops tags that load from other domains when the
 *  portal forbids them (fonts from a CDN, for example: bundle them instead). */
export function platformHtml() {
  return {
    name: "platform-html",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const head = HEAD[target]?.();
        if (!head) return html;
        return html
          .replace(/<link rel="preconnect"[^>]*>\s*/g, "")
          .replace(/<link[^>]+href="https:\/\/fonts\.googleapis[^>]*>\s*/g, "")
          .replace("<head>", `<head>${head}`);
      },
    },
  };
}

/** Portal builds ship without source maps. */
export function platformBuild() {
  return { sourcemap: target === "" };
}
