// The trailer's script, evaluated inside the game by record.mjs. It plays through the real game: real
// physics, enemies and effects. Nothing here ships with the game. Copy to tools/trailer/director.js and adapt.
(() => {
  const g = window.__game;
  const FPS = 60;

  // A cut is a list of shots. Each shot: a label, a length in seconds, and what to do on every frame.
  const SHOTS = [
    { name: 'opening', seconds: 3, frame: (t) => { /* t = seconds since the shot began: move the camera, hold a key */ } },
    { name: 'action', seconds: 5, frame: (t) => {} },
  ];

  let soundLog = [];
  const startAt = () => window.__clock.now();
  let t0 = 0;

  window.__dir = {
    /** Once, when the game is ready. Put the game into a clean, repeatable state. */
    setup() {
      // Hide what does not belong in a trailer (cursor, debug text, toasts):
      const css = document.createElement('style');
      css.textContent = '* { cursor: none !important }';
      document.head.append(css);
      // Typical steps (adapt): skip the tutorial, make the player invulnerable, stop automatic pausing,
      // turn the best graphics on, start a run.
      //   g.pause = () => {};
      //   g.start();
      t0 = startAt();
    },

    /** Before every frame. Returns the shot's label, or null when the trailer is over. */
    frame(n) {
      let t = n / FPS;
      for (const shot of SHOTS) {
        if (t < shot.seconds) {
          shot.frame(t);
          return shot.name;
        }
        t -= shot.seconds;
      }
      return null;
    },

    /** Optional: sounds for mix.mjs, as [{ kind, at (seconds from the first frame), o }]. Fill soundLog in setup()
     *  by wrapping the game's synth calls, e.g. soundLog.push({ kind: 'tone', at: (__clock.now() - t0) / 1000, o }). */
    sounds: () => (soundLog.length ? soundLog : null),
  };
})();
