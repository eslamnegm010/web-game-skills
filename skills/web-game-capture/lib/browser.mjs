// Drives a muted headless Chrome over the DevTools protocol. No dependencies (Node 22+).
//   const page = await launch({ width: 1280, height: 720 });
//   await page.goto(url, { ready: '!!window.__game' });
//   await page.shot('out.png');
//   await page.close();
// Chrome is always muted and always killed, also when the script crashes.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

// Windows install roots (Program Files, the x86 one, the per-user one): Chrome, then Chromium,
// then Edge — Edge is Chromium under the hood and speaks the same DevTools protocol.
const winRoots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
const winPaths = winRoots.flatMap((base) => [
  `${base}\\Google\\Chrome\\Application\\chrome.exe`,
  `${base}\\Chromium\\Application\\chrome.exe`,
  `${base}\\Microsoft\\Edge\\Application\\msedge.exe`,
]);

const CHROME_PATHS = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  ...winPaths,
];

export const DEVICES = {
  iphone: {
    width: 390, height: 844, scale: 2, mobile: true,
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
  android: {
    width: 412, height: 915, scale: 2, mobile: true,
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  },
  ipad: {
    width: 820, height: 1180, scale: 2, mobile: true,
    ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
  chromebook: { width: 1366, height: 768, scale: 1, mobile: false, ua: '' },
  desktop: { width: 1280, height: 720, scale: 1, mobile: false, ua: '' },
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

export function findChrome() {
  const found = CHROME_PATHS.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME=/path/to/chrome');
  return found;
}

/**
 * @param {object} [o]
 * @param {number} [o.width=1280] @param {number} [o.height=720]
 * @param {boolean} [o.gpu=false] true renders on the real GPU (sharp, fast: for videos and store shots);
 *   false uses the software renderer (works everywhere, same pixels on every machine: for tests).
 * @param {string} [o.profile] Chrome profile folder; a temporary one is made and removed by default.
 * @param {string[]} [o.args] extra Chrome flags.
 */
export async function launch(o = {}) {
  const port = o.port ?? (await freePort());
  const ownProfile = !o.profile;
  const profile = o.profile ?? fs.mkdtempSync(path.join(os.tmpdir(), 'web-game-chrome-'));
  const gpuArgs = o.gpu
    ? [process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=default', '--enable-gpu-rasterization', '--ignore-gpu-blocklist']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new', '--mute-audio', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      ...gpuArgs, ...(o.args ?? []),
      `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
      `--window-size=${o.width ?? 1280},${o.height ?? 720}`, 'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let closed = false;
  const kill = () => {
    if (closed) return;
    closed = true;
    // On Windows, killing the main process can leave Chrome's child processes behind: take the tree.
    if (process.platform === 'win32' && chrome.pid) {
      try { spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* already gone */ }
    }
    try { chrome.kill('SIGKILL'); } catch { /* already gone */ }
    if (ownProfile) try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* still locked */ }
  };
  process.once('exit', kill);
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { kill(); process.exit(130); });

  let targets;
  for (let i = 0; i < 100 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(100); }
  }
  if (!targets) { kill(); throw new Error('Chrome did not start'); }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('DevTools socket failed')); });

  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push(String(d?.exception?.description ?? d?.text ?? 'exception').slice(0, 400));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Page.enable');
  await send('Runtime.enable');
  let size = { width: o.width ?? 1280, height: o.height ?? 720 };

  const page = {
    send,
    /** Uncaught exceptions and console.error lines seen so far. */
    errors,
    get size() { return size; },

    /** Evaluates an expression in the page and returns its value. Wrap statements in (() => { ... })(). */
    async ev(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      const ex = r.result?.exceptionDetails;
      if (ex) throw new Error(`page threw: ${String(ex.exception?.description ?? ex.text).slice(0, 600)}\n  in: ${expression.slice(0, 200)}`);
      return r.result?.result?.value;
    },

    /** Polls until the expression is truthy. Headless Chrome is slow: wait on conditions, never on fixed sleeps. */
    async until(expression, ms = 20000, every = 150) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        try { if (await page.ev(expression)) return true; } catch { /* page still loading */ }
        await sleep(every);
      }
      return false;
    },

    /** Runs a script before every page load (fake SDKs, fake clocks). */
    inject: (source) => send('Page.addScriptToEvaluateOnNewDocument', { source }),

    async goto(url, { ready = "document.readyState === 'complete'", timeout = 60000 } = {}) {
      await send('Page.navigate', { url });
      return page.until(ready, timeout);
    },

    async viewport(width, height, { mobile = false, scale = 1, landscape = width > height, ua } = {}) {
      size = { width, height };
      if (ua !== undefined) await send('Emulation.setUserAgentOverride', { userAgent: ua });
      await send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: scale, mobile,
        screenOrientation: mobile ? { type: landscape ? 'landscapePrimary' : 'portraitPrimary', angle: landscape ? 90 : 0 } : undefined,
      });
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
    },

    /** Emulates a device from DEVICES (iphone, android, ipad, chromebook, desktop). */
    async device(name, { landscape = false } = {}) {
      const d = DEVICES[name];
      if (!d) throw new Error(`unknown device: ${name} (${Object.keys(DEVICES).join(', ')})`);
      const [w, h] = d.mobile && landscape ? [d.height, d.width] : [d.width, d.height];
      await page.viewport(w, h, { mobile: d.mobile, scale: d.scale, landscape, ua: d.ua });
    },

    /** Saves a screenshot; the format follows the extension (.png, .jpg, .webp). Returns the file path. */
    async shot(file, { quality = 95, clip } = {}) {
      const ext = path.extname(file).slice(1).toLowerCase();
      const format = ext === 'jpg' ? 'jpeg' : ext || 'png';
      const r = await send('Page.captureScreenshot', {
        format, ...(format === 'png' ? {} : { quality }),
        clip: clip ?? { x: 0, y: 0, width: size.width, height: size.height, scale: 1 },
      });
      if (!r.result?.data) throw new Error(`screenshot failed: ${JSON.stringify(r.error ?? r).slice(0, 300)}`);
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      return file;
    },

    async tap(x, y) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    async click(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    },
    async key(key, { code = key, hold = 60 } = {}) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await sleep(hold);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    },

    async close() {
      try { ws.close(); } catch { /* closed */ }
      kill();
    },
  };
  if (o.width || o.height) await page.viewport(size.width, size.height);
  return page;
}
