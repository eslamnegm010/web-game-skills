// Unit tests for the platform layer templates (run with: node --test tests/*.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const T = '../skills/web-game-portals/templates/platform/';
const { default: createCrazyGames } = await import(T + 'crazygames.js');
const { default: createPlaygama } = await import(T + 'playgama.js');
const { platform } = await import(T + 'index.js');
const { platformTarget } = await import(T + 'vite.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeCrazy({ ad }) {
  return {
    environment: 'crazygames',
    init: async () => {},
    data: { getItem: () => null, setItem() {}, removeItem() {} },
    game: { loadingStart() {}, loadingStop() {}, gameplayStart() {}, gameplayStop() {}, settings: { muteAudio: false } },
    ad: { hasAdblock: async () => false, requestAd: ad },
  };
}
const counting = () => {
  const c = { start: 0, end: 0 };
  return { c, hooks: { adStart: () => c.start++, adEnd: () => c.end++ } };
};

test('crazygames: a normal ad pauses once and resumes once', async () => {
  const { c, hooks } = counting();
  const sdk = fakeCrazy({ ad: (_t, cb) => { cb.adStarted(); setTimeout(() => cb.adFinished(), 5); } });
  const p = createCrazyGames(hooks, { getSdk: () => sdk });
  assert.equal(await p.init(), true);
  assert.equal(await p.rewardedAd(), true);
  assert.deepEqual(c, { start: 1, end: 1 });
});

test('crazygames: an ad that starts after the timeout never freezes the game', async () => {
  const { c, hooks } = counting();
  const sdk = fakeCrazy({ ad: (_t, cb) => { setTimeout(() => cb.adStarted(), 30); setTimeout(() => cb.adFinished(), 40); } });
  const p = createCrazyGames(hooks, { getSdk: () => sdk, adTimeout: 10 });
  await p.init();
  assert.equal(await p.rewardedAd(), false);
  await sleep(60);
  assert.equal(c.start, c.end, 'every adStart has its adEnd');
  assert.equal(c.start, 0);
});

test('crazygames: an unfilled ad resumes nothing and gives no reward', async () => {
  const { c, hooks } = counting();
  const sdk = fakeCrazy({ ad: (_t, cb) => setTimeout(() => cb.adError({ code: 'unfilled' }), 5) });
  const p = createCrazyGames(hooks, { getSdk: () => sdk });
  await p.init();
  assert.equal(await p.rewardedAd(), false);
  assert.deepEqual(c, { start: 0, end: 0 });
  assert.equal(p.canShowAds, true, 'unfilled is per request');
});

test('crazygames: adblock turns ads off for the session', async () => {
  const sdk = fakeCrazy({ ad: (_t, cb) => cb.adError({ code: 'adblock' }) });
  const p = createCrazyGames({}, { getSdk: () => sdk });
  await p.init();
  await p.midgameAd();
  assert.equal(p.canShowAds, false);
});

test('playgama: a "rewarded" state left over from the previous ad is not a reward', async () => {
  const listeners = {};
  const adv = {
    isRewardedSupported: true,
    isInterstitialSupported: true,
    rewardedState: 'rewarded', // latched from the last ad
    on: (e, fn) => (listeners[e] = fn),
    off() {},
    showRewarded() {
      setTimeout(() => { adv.rewardedState = 'loading'; listeners.rewarded_state_changed?.('loading'); }, 5);
      setTimeout(() => { adv.rewardedState = 'failed'; listeners.rewarded_state_changed?.('failed'); }, 10);
    },
  };
  const bridge = {
    initialize: async () => {},
    platform: { language: 'pt-BR', sendMessage() {}, on() {}, isAudioEnabled: true },
    storage: { get: async (keys) => keys.map(() => null), set: async () => {}, delete: async () => {} },
    advertisement: adv,
    player: { name: 'tester' },
  };
  const p = createPlaygama({}, { getBridge: () => bridge, localStorage: { length: 0, key: () => null } });
  assert.equal(await p.init(), true);
  assert.equal(p.preferredLanguage(), 'pt');
  assert.equal(await p.rewardedAd(), false);
});

test('playgama: cloud saves come back as the strings that were stored', async () => {
  // The template's config.js still holds the "__SAVE_PREFIX__" placeholder, so that is the prefix here.
  const P = '__SAVE_PREFIX__';
  const cloud = new Map([[`${P}__keys__`, [`${P}save`]], [`${P}save`, { level: 3 }]]); // Bridge parses on read
  const bridge = {
    initialize: async () => {},
    platform: { sendMessage() {}, on() {}, isAudioEnabled: true },
    storage: { get: async (keys) => keys.map((k) => cloud.get(k) ?? null), set: async () => {}, delete: async () => {} },
    advertisement: {},
  };
  const p = createPlaygama({}, { getBridge: () => bridge, localStorage: { length: 0, key: () => null } });
  await p.init();
  assert.equal(p.storage.getItem(`${P}save`), '{"level":3}', 'not "[object Object]"');
});

test('facade: with no portal it is the web platform and init never throws', async () => {
  assert.equal(await platform.init(), true);
  assert.equal(platform.name, 'web');
  assert.equal(await platform.rewardedAd(), false);
  assert.equal(platform.canShowAds, false);
});

test('vite: the build mode picks the portal; Vite modes mean the plain web build', () => {
  const saved = process.env.VITE_PLATFORM;
  delete process.env.VITE_PLATFORM;
  assert.equal(platformTarget('production'), '');
  assert.equal(platformTarget('development'), '');
  assert.equal(platformTarget('crazygames'), 'crazygames');
  process.env.VITE_PLATFORM = 'y8';
  assert.equal(platformTarget('crazygames'), 'y8', 'VITE_PLATFORM still overrides');
  if (saved === undefined) delete process.env.VITE_PLATFORM; else process.env.VITE_PLATFORM = saved;
});
