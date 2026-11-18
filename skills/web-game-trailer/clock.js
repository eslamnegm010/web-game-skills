// Injected before the game loads: a fake clock and a seeded Math.random, so the game advances only when the
// recorder says so. One step is one video frame, however slow the machine is, and every take is identical.
(() => {
  let now = 1000;
  let seed = window.__CLOCK_SEED ?? 20260101;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rafs = new Map();
  const timers = new Map();
  let nextId = 1;
  performance.now = () => now;
  const realNow = Date.now();
  Date.now = () => realNow + now;
  window.requestAnimationFrame = (fn) => {
    const id = nextId++;
    rafs.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => rafs.delete(id);
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + ms, fn, args });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + ms, every: Math.max(1, ms), fn, args });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  const run = (t) => {
    for (const [id, x] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (x.at > t || !timers.has(id)) continue;
      if (x.every) x.at += x.every;
      else timers.delete(id);
      x.fn(...x.args);
    }
  };
  window.__clock = {
    now: () => now,
    /** Advances the game by `ms`: due timers first, then one animation frame. */
    step(ms) {
      now += ms;
      run(now);
      const list = [...rafs.values()];
      rafs.clear();
      for (const fn of list) fn(now);
    },
    /** Many steps at once, without capturing: loading, warm-up, skipping a banner. */
    idle(n, ms = 33) {
      for (let i = 0; i < n; i++) this.step(ms);
    },
  };
})();
