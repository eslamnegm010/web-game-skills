// The game boots, shows a full-size canvas and throws nothing. Adapt READY and the start step to the game.
const { suite } = await import(process.env.WEB_GAME_QA);

// The game exposes itself as window.__game behind ?debug (web-game-capture: "Make the game capturable").
const READY = '!!window.__game'; // what tells us the game is loaded

await suite('smoke', { width: 1280, height: 720 }, async ({ page, ok, shot, url, noErrors }) => {
  ok('game loads', await page.goto(`${url}?debug`, { ready: READY, timeout: 60000 }));
  ok(
    'canvas fills the window',
    await page.ev(`(() => { const c = document.querySelector('canvas'); return !!c && Math.abs(c.clientWidth - innerWidth) < 2 && Math.abs(c.clientHeight - innerHeight) < 2; })()`),
    await page.ev('innerWidth + "x" + innerHeight'),
  );
  await shot('first-screen');
  // TODO: start a run the way a player does (click the play button, press a key) and check the state:
  //   await page.ev(`document.querySelector('#play').click(); true`);
  //   ok('playing', await page.until(`__game.state === 'playing'`, 10000));
  //   await shot('playing');
  noErrors();
});
