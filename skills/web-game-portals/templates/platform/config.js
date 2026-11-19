/** Per-game platform settings. Ids come from each portal's developer dashboard; never guess them. */
export const PLATFORM_CONFIG = {
  /** Prefix of this game's storage keys: saves made before an SDK existed are copied into the account once. */
  savePrefix: "__SAVE_PREFIX__",
  /** The longest platform.init() may hold up the boot, in ms (the adapters give up sooner on their own). */
  initTimeout: 12000,
  y8: { appId: "", gameId: "" },
};
