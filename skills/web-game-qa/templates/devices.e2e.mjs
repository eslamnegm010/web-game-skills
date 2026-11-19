// Phones and small laptops: the game must start in any orientation (no "rotate your phone" wall), fill the
// screen and keep working when the phone is rotated. Portals measure mobile and desktop separately.
const { suite } = await import(process.env.WEB_GAME_QA);

const READY = '!!window.__game';
const FILLS = `(() => { const c = document.querySelector('canvas'); return !!c && Math.abs(c.clientWidth - innerWidth) < 2 && Math.abs(c.clientHeight - innerHeight) < 2; })()`;
// No horizontal scroll and no element wider than the screen.
const FITS = 'document.documentElement.scrollWidth <= innerWidth + 1';

await suite('devices', {}, async ({ page, ok, shot, url, noErrors }) => {
  for (const [device, landscape] of [['iphone', false], ['iphone', true], ['android', false], ['android', true], ['chromebook', false]]) {
    const label = `${device}${device === 'chromebook' ? '' : landscape ? ' landscape' : ' portrait'}`;
    await page.device(device, { landscape });
    ok(`${label}: loads`, await page.goto(`${url}?debug&d=${Math.random()}`, { ready: READY, timeout: 60000 }));
    // iPhone Safari has no fullscreen and no orientation lock: the game must not depend on them.
    if (device === 'iphone') await page.ev('Element.prototype.requestFullscreen = undefined; Element.prototype.webkitRequestFullscreen = undefined; true');
    ok(`${label}: canvas fills the screen`, await page.ev(FILLS), await page.ev('innerWidth + "x" + innerHeight'));
    ok(`${label}: nothing wider than the screen`, await page.ev(FITS));
    await shot(label.replace(/ /g, '-'));
  }
  // Rotating in the middle of a session: the canvas follows.
  await page.device('iphone', { landscape: false });
  await page.goto(`${url}?debug&d=rotate`, { ready: READY });
  await page.device('iphone', { landscape: true });
  ok('iphone rotated mid-session: canvas resized', await page.until(FILLS, 5000));
  noErrors();
});
