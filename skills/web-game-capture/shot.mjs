#!/usr/bin/env node
// Screenshots of a web game in muted headless Chrome.
//   shot.mjs <url> <out.png> [options]          one shot
//   shot.mjs --batch <shots.json> --out <dir>   many shots, one browser
// Options: --size 1920x1080 · --device iphone|android|ipad|chromebook|desktop · --landscape
//          --wait "<js expression>" (default: page loaded) · --eval "<js>" (runs after wait) · --delay <ms>
//          --gpu (real GPU: sharper, for store shots) · --timeout <ms>
// A batch file is a JSON array of { name, url, size, device, landscape, wait, eval, delay }.
// <url> may be relative ('/', '?debug'): it is resolved against --base, or $URL from with-preview.sh.
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep } from './lib/browser.mjs';

const argv = process.argv.slice(2);
const flags = {};
const rest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) rest.push(a);
  else if (['gpu', 'landscape'].includes(a.slice(2))) flags[a.slice(2)] = true;
  else flags[a.slice(2)] = argv[++i];
}
const usage = () => {
  console.error('usage: shot.mjs <url> <out.png> [--size WxH] [--device name] [--landscape] [--wait expr] [--eval js] [--delay ms] [--gpu]\n' +
    '       shot.mjs --batch shots.json --out dir [--base url] [--gpu]');
  process.exit(2);
};

// A url that is not absolute is resolved against $URL (set by with-preview.sh): '/', '?debug', 'page.html'.
const absolute = (u = '') => {
  if (/^https?:/.test(u)) return u;
  const base = flags.base ?? process.env.URL;
  if (!base) { console.error(`relative url "${u}" needs --base or $URL (run through with-preview.sh)`); process.exit(2); }
  return new URL(u, base).href;
};

let jobs;
if (flags.batch) {
  if (!flags.out) usage();
  jobs = JSON.parse(fs.readFileSync(flags.batch, 'utf8')).map((j) => ({
    ...j,
    url: absolute(j.url),
    file: path.join(flags.out, j.file ?? `${j.name}.png`),
  }));
} else {
  if (rest.length < 2) usage();
  jobs = [{ ...flags, url: absolute(rest[0]), file: rest[1] }];
}

const page = await launch({ gpu: !!flags.gpu });
let failed = 0;
try {
  for (const j of jobs) {
    if (j.device) await page.device(j.device, { landscape: !!j.landscape });
    else {
      const [w, h] = String(j.size ?? '1280x720').split('x').map(Number);
      await page.viewport(w, h);
    }
    const ready = await page.goto(j.url, { ready: j.wait ?? "document.readyState === 'complete'", timeout: +(j.timeout ?? flags.timeout ?? 60000) });
    if (!ready) { console.error(`FAIL ${j.file}: wait condition never became true`); failed++; continue; }
    if (j.eval) await page.ev(j.eval);
    await sleep(+(j.delay ?? 300));
    await page.shot(j.file);
    console.log(`saved ${j.file} (${page.size.width}x${page.size.height})`);
  }
  for (const e of page.errors) console.error('PAGE ERROR', e);
} catch (e) {
  console.error(e.message);
  failed++;
} finally {
  await page.close();
}
process.exit(failed ? 1 : 0);
