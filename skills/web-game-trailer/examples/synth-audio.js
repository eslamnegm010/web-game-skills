// Example renderer for mix.mjs, from a game whose sound engine is a WebAudio synth with tone(o) and noise(o)
// methods that accept a `delay` in seconds. It builds a second engine on an OfflineAudioContext, replays the
// logged calls at their times, and returns a 16-bit stereo WAV as base64. Adapt the three marked lines.
window.renderAudio = async function (seconds, sounds) {
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(sampleRate * seconds), sampleRate);
  const Real = window.AudioContext;
  window.AudioContext = window.webkitAudioContext = function () {
    return offline;
  };
  const engine = new window.__game.audio.constructor(); // ADAPT: how the game builds its sound engine
  engine.init(); //                                        ADAPT: whatever creates its AudioContext
  window.AudioContext = Real;
  for (const { kind, at, o } of sounds) {
    const when = at + (o.delay || 0);
    if (when >= 0 && when < seconds) engine[kind]({ ...o, delay: when }); // ADAPT: schedule one sound at `when`
  }
  const buffer = await offline.startRendering();
  const n = buffer.length;
  const data = new DataView(new ArrayBuffer(44 + n * 4));
  const text = (offset, s) => [...s].forEach((c, i) => data.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  data.setUint32(4, 36 + n * 4, true);
  text(8, 'WAVEfmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 2, true);
  data.setUint32(24, sampleRate, true);
  data.setUint32(28, sampleRate * 4, true);
  data.setUint16(32, 4, true);
  data.setUint16(34, 16, true);
  text(36, 'data');
  data.setUint32(40, n * 4, true);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  for (let i = 0; i < n; i++) {
    data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, left[i])) * 32767, true);
    data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, right[i])) * 32767, true);
  }
  const bytes = new Uint8Array(data.buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
};
