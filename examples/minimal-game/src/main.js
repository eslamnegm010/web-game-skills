// The smallest game that is wired the way the web-game skills expect: the platform layer at boot, saves
// through platform.storage, gameplay signals around real play, ads only at a break, and window.__game
// behind ?debug so tests, screenshots and trailers can drive it.
import { platform } from "./platform/index.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const playButton = document.getElementById("play");

const game = {
  state: "menu",
  score: 0,
  best: 0,
  muted: false,
  adActive: false,
  x: 0.5,
  t: 0,
  start() {
    playButton.hidden = true;
    this.state = "playing";
    this.score = 0;
    platform.gameplayStart();
  },
  async over() {
    this.state = "over";
    platform.gameplayStop();
    if (this.score > this.best) {
      this.best = this.score;
      platform.storage.setItem("minimal_best", String(this.best));
    }
    await platform.midgameAd(); // a natural break: after a run, never during one
    playButton.hidden = false;
    this.state = "menu";
  },
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); // frame-rate independent
  last = now;
  if (game.state === "playing" && !game.adActive) {
    game.t += dt;
    game.x = 0.5 + 0.4 * Math.sin(game.t * 2);
    game.score += dt * 10;
  }
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = "#f2aa4c";
  ctx.beginPath();
  ctx.arc(game.x * innerWidth, innerHeight / 2, Math.min(innerWidth, innerHeight) * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "600 20px system-ui";
  ctx.fillText(`Score ${Math.floor(game.score)}   Best ${Math.floor(game.best)}`, 16, 32);
  requestAnimationFrame(frame);
}

async function boot() {
  await platform.init();
  platform.loadingStart();
  game.best = Number(platform.storage.getItem("minimal_best") ?? 0);
  platform.onAdStart(() => (game.adActive = true));
  platform.onAdEnd(() => (game.adActive = false));
  platform.onMute((m) => (game.muted = m));
  addEventListener("resize", resize);
  resize();
  playButton.addEventListener("click", () => game.start());
  canvas.addEventListener("pointerdown", () => game.state === "playing" && game.over());
  requestAnimationFrame(frame);
  platform.loadingStop(); // the first playable screen is up
  if (new URLSearchParams(location.search).has("debug")) window.__game = game;
}

boot();
