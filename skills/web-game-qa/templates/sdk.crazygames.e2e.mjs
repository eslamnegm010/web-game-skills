// The CrazyGames build with a fake SDK injected before load: loading and gameplay signals, saves through the
// Data module, and ads that pause and mute the game. The file name's ".crazygames" makes run.sh use that build.
const { suite, fake } = await import(process.env.WEB_GAME_QA);

const FAKE_SDK = fake('crazygames-sdk');
const READY = '!!window.__game';
const count = (name) => `window.__sdk.calls.filter((c) => c === ${JSON.stringify(name)}).length`;

await suite('sdk', { inject: [FAKE_SDK] }, async ({ page, ok, url, noErrors }) => {
  ok('game boots with the fake SDK', await page.goto(`${url}?debug`, { ready: READY, timeout: 60000 }));
  ok('loadingStart sent', await page.until(`${count('loadingStart')} >= 1`, 10000));
  ok('loadingStop sent when the first screen is ready', await page.until(`${count('loadingStop')} >= 1`, 20000));
  ok('no gameplayStart before the player starts', (await page.ev(count('gameplayStart'))) === 0);

  // TODO: start a run the way a player does, then:
  //   ok('gameplayStart sent once', await page.until(`${count('gameplayStart')} === 1`, 10000));
  // TODO: reach a break point (level end, death) and check the ad pauses and mutes the game:
  //   ok('midgame ad requested', await page.until(`window.__sdk.calls.includes('ad:midgame')`, 10000));
  //   ok('game paused and muted during the ad', await page.until(`__game.adActive === true`, 3000));
  //   ok('game back after the ad', await page.until(`__game.adActive === false`, 10000));
  // TODO: unfilled rewarded ad gives no reward:
  //   await page.ev(`window.__sdk.adMode = 'error'; true`);
  // TODO: the site's mute button silences the game:
  //   await page.ev(`window.__sdk.settingsListener({ muteAudio: true }); true`);
  // TODO: a save goes through the Data module:
  //   ok('saved through the SDK', await page.until(`window.__sdk.data.size > 0`, 5000));
  noErrors();
});
