// One browser suite: opens the game, gives you checks, prints PASS/FAIL lines, always closes Chrome.
//   const { suite } = await import(process.env.WEB_GAME_QA);
//   await suite('smoke', {}, async ({ page, ok, info, shot, url }) => { ... });
// run.sh sets URL (the served build), OUT (screenshot folder) and WEB_GAME_QA (this file).
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, DEVICES } from '../../web-game-capture/lib/browser.mjs';

export { sleep, DEVICES };

/** The source of a fake portal SDK from fakes/ (for `inject`): fake('crazygames-sdk'). */
export const fake = (name) => fs.readFileSync(new URL(`../fakes/${name}.js`, import.meta.url), 'utf8');

/**
 * @param {string} name
 * @param {{ width?: number, height?: number, gpu?: boolean, inject?: string[] }} options
 *   `inject`: scripts run before every page load (a fake portal SDK, for example).
 * @param {(t: object) => Promise<void>} body
 */
export async function suite(name, options, body) {
  const url = process.env.URL ?? 'http://localhost:4173/';
  const out = path.join(process.env.OUT ?? path.join(process.cwd(), '.e2e-out'), name);
  const lines = [];
  let failed = 0;
  const ok = (label, condition, detail = '') => {
    if (!condition) failed++;
    lines.push(`${condition ? 'PASS' : 'FAIL'} ${label}${detail !== '' ? ` (${detail})` : ''}`);
    return !!condition;
  };
  const info = (text) => lines.push(`INFO ${text}`);
  let page;
  try {
    page = await launch({ width: options.width ?? 1280, height: options.height ?? 720, gpu: options.gpu });
    for (const source of options.inject ?? []) await page.inject(source);
    await body({
      page, ok, info, url, out,
      shot: (file) => page.shot(path.join(out, file.includes('.') ? file : `${file}.png`)),
      /** The last check of most suites: nothing threw and nothing was logged with console.error. */
      noErrors: (label = 'no page errors') => ok(label, page.errors.length === 0, page.errors.slice(0, 3).join(' | ')),
    });
  } catch (e) {
    failed++;
    lines.push(`FAIL exception ${String(e.stack ?? e).split('\n').slice(0, 3).join(' ')}`);
  } finally {
    await page?.close();
  }
  console.log(lines.join('\n'));
  process.exitCode = failed ? 1 : 0;
}
