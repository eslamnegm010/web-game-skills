// A fake CrazyGames SDK v3, injected before the game loads. It records every call in window.__sdk so a test
// can check the integration without the real site.
//   __sdk.calls        ['loadingStart', 'loadingStop', 'gameplayStart', 'ad:midgame', ...]
//   __sdk.adMode       'finish' (default) or 'error' (unfilled ad)
//   __sdk.data         Map behind the Data module
//   __sdk.settingsListener({ muteAudio: true })   the site's mute button
//   __sdk.joinListener({ room: 'ABCD' })          a friend's invite
(() => {
  const data = new Map();
  window.__sdk = { calls: [], data, adMode: 'finish', ads: 0, lastType: null, username: 'Crazy_Tester_2026xy' };
  const c = (n) => window.__sdk.calls.push(n);
  window.CrazyGames = {
    SDK: {
      environment: 'crazygames',
      init: async () => {},
      data: {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, v),
        removeItem: (k) => data.delete(k),
        clear: () => data.clear(),
      },
      game: {
        loadingStart: () => c('loadingStart'),
        loadingStop: () => c('loadingStop'),
        gameplayStart: () => c('gameplayStart'),
        gameplayStop: () => c('gameplayStop'),
        happytime: () => c('happytime'),
        inviteLink: (o) => 'https://www.crazygames.com/game/test?room=' + o.room,
        getInviteParam: () => null,
        updateRoom: () => c('updateRoom'),
        leftRoom: () => c('leftRoom'),
        isInstantMultiplayer: false,
        settings: { muteAudio: false, disableChat: false },
        addSettingsChangeListener: (fn) => (window.__sdk.settingsListener = fn),
        addJoinRoomListener: (fn) => (window.__sdk.joinListener = fn),
      },
      user: {
        isUserAccountAvailable: true,
        getUser: async () => ({ username: window.__sdk.username, profilePictureUrl: '' }),
        addAuthListener: (fn) => (window.__sdk.authListener = fn),
      },
      ad: {
        hasAdblock: async () => false,
        requestAd: (type, cb) => {
          window.__sdk.ads++;
          window.__sdk.lastType = type;
          c('ad:' + type);
          cb.adStarted?.();
          setTimeout(() => (window.__sdk.adMode === 'finish' ? cb.adFinished?.() : cb.adError?.({ code: 'unfilled', message: 'no fill' })), 600);
        },
      },
    },
  };
})();
