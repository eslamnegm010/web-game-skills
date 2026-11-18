#!/usr/bin/env node
// Renders a take's logged sounds to a WAV through the game's own synth, offline (faster than real time).
//   mix.mjs <url> <take.json> <out.wav> --renderer <file.js> [--ready "<js>"] [--tail <seconds>]
// The renderer is a script evaluated in a normal page of the game (no fake clock). It defines
//   window.renderAudio(seconds, sounds) -> Promise<base64 16-bit WAV>     see examples/synth-audio.js
// Only for games that synthesise their sound. A game with audio files: lay a music track with
// `cut.sh trailer --audio <file>` instead.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from '../web-game-capture/lib/browser.mjs';

const argv = process.argv.slice(2);
const flags = {};
const rest = [];
for (let i = 0; i < argv.length; i++) (argv[i].startsWith('--') ? (flags[argv[i].slice(2)] = argv[++i]) : rest.push(argv[i]));
const [rawUrl, takeFile, out] = rest;
const url = !rawUrl || /^https?:/.test(rawUrl) ? rawUrl : process.env.URL ? new URL(rawUrl, process.env.URL).href : null;
if (!url || !takeFile || !out || !flags.renderer) {
  console.error('usage: mix.mjs <url> <take.json> <out.wav> --renderer <file.js> [--ready expr] [--tail seconds]');
  process.exit(2);
}
const take = JSON.parse(fs.readFileSync(takeFile, 'utf8'));
if (!take.sounds) { console.error('the take has no sounds: the director needs a sounds() function'); process.exit(1); }
const seconds = take.seconds + +(flags.tail ?? 0);
const page = await launch({});
const timer = setTimeout(() => { console.error('TIMEOUT'); page.close().then(() => process.exit(1)); }, 180000);
let code = 0;
try {
  if (!(await page.goto(url, { ready: flags.ready ?? '!!window.__game', timeout: 60000 }))) throw new Error('the game never became ready');
  await page.ev(fs.readFileSync(path.resolve(flags.renderer), 'utf8') + '\n;true');
  // Large DevTools replies stall: render first, then read the result in pieces.
  const size = await page.ev(`window.renderAudio(${seconds}, ${JSON.stringify(take.sounds)}).then((w) => { window.__wav = w; return w.length; })`);
  let b64 = '';
  for (let i = 0; i < size; i += 1 << 20) b64 += await page.ev(`window.__wav.slice(${i}, ${i + (1 << 20)})`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`${out}: ${fs.statSync(out).size} bytes, ${seconds.toFixed(1)} s, ${take.sounds.length} sounds`);
} catch (e) {
  console.error('ERR', e.message);
  code = 1;
} finally {
  clearTimeout(timer);
  await page.close();
}
process.exit(code);
