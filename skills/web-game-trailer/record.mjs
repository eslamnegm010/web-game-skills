#!/usr/bin/env node
// Films a web game frame by frame under a fake clock: every frame is rendered, however slow the machine is.
//   record.mjs <url> <frames dir> --director <file.js> [options]
// Options: --size 2560x1440 (film larger than the final cut, then scale down) · --fps 60 · --every 1 (30 =
//          one frame in 30: a quick contact sheet) · --ready "<js>" (default "!!window.__game")
//          --warmup <frames> (default 120) · --max <frames> (default 3600) · --seed <n> · --software (no GPU)
// The director is a script evaluated in the page. It defines window.__dir:
//   setup()            once, after the game is ready: start a run, hide HUD parts, disable pausing...
//   frame(n, seconds)  before every frame: set input, camera, spawns. Returns a shot label, or null to end.
//   sounds()           optional: the sounds logged during the take, for mix.mjs
// Writes f00000.jpg ... and take.json { frames, seconds, fps, size, sounds }.
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from '../web-game-capture/lib/browser.mjs';

const argv = process.argv.slice(2);
const flags = {};
const rest = [];
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) rest.push(argv[i]);
  else if (argv[i] === '--software') flags.software = true;
  else flags[argv[i].slice(2)] = argv[++i];
}
const [rawUrl, out] = rest;
// A relative url ('/', '?debug') is resolved against $URL, which with-preview.sh sets.
const url = !rawUrl || /^https?:/.test(rawUrl) ? rawUrl : process.env.URL ? new URL(rawUrl, process.env.URL).href : null;
if (!url || !out || !flags.director) {
  console.error('usage: record.mjs <url> <frames dir> --director <file.js> [--size WxH] [--fps 60] [--every 1] [--ready expr] [--warmup n] [--max n] [--seed n] [--software]');
  process.exit(2);
}
const [W, H] = String(flags.size ?? '2560x1440').split('x').map(Number);
const fps = +(flags.fps ?? 60);
const every = +(flags.every ?? 1);
const max = +(flags.max ?? 3600);
const step = 1000 / fps;
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const page = await launch({ width: W, height: H, gpu: !flags.software });
let code = 0;
try {
  if (flags.seed) await page.inject(`window.__CLOCK_SEED = ${+flags.seed};`);
  await page.inject(fs.readFileSync(new URL('./clock.js', import.meta.url), 'utf8'));
  await page.send('Page.navigate', { url });
  // Loading needs real time (network, decoding) and game time (timers) together.
  const ready = flags.ready ?? '!!window.__game';
  let loaded = false;
  for (let i = 0; i < 1200 && !loaded; i++) {
    try { await page.ev('window.__clock && __clock.idle(2)'); loaded = !!(await page.ev(ready)); } catch { /* navigating */ }
    if (!loaded) await sleep(50);
  }
  if (!loaded) throw new Error(`the game never became ready (${ready})`);
  await page.ev('__clock.idle(60)');
  await page.ev(fs.readFileSync(path.resolve(flags.director), 'utf8'));
  if (!(await page.ev('typeof window.__dir?.frame === "function"'))) throw new Error('the director must define window.__dir.frame(n, seconds)');
  await page.ev('Promise.resolve(window.__dir.setup?.()).then(() => true)');
  await page.ev(`__clock.idle(${+(flags.warmup ?? 120)}, ${step})`);

  const t0 = Date.now();
  let n = 0;
  let last = '';
  for (; n < max; n++) {
    const label = await page.ev(`Promise.resolve(window.__dir.frame(${n}, ${n / fps})).then((s) => s ?? null)`);
    if (!label) break;
    if (label !== last) { console.log(`shot ${label} at frame ${n} (${(n / fps).toFixed(1)} s)`); last = label; }
    await page.ev(`__clock.step(${step})`);
    if (n % every === 0) await page.shot(path.join(out, `f${String(n).padStart(5, '0')}.jpg`), { quality: 97 });
  }
  const sounds = (await page.ev('window.__dir.sounds ? window.__dir.sounds() : null')) ?? null;
  fs.writeFileSync(path.join(out, 'take.json'), JSON.stringify({ frames: n, seconds: n / fps, fps, size: [W, H], every, sounds }));
  console.log(`frames ${n} · ${(n / fps).toFixed(1)} s of video · took ${((Date.now() - t0) / 1000).toFixed(0)} s · page errors ${page.errors.length}`);
  for (const e of page.errors.slice(0, 5)) console.log('PAGE ERROR', e);
  if (n === 0) throw new Error('the director ended before the first frame');
} catch (e) {
  console.error('ERR', e.message);
  code = 1;
} finally {
  await page.close();
}
process.exit(code);
