# Minimal game

A tiny canvas game wired the way the web-game skills expect. It is the test bed for this repository's
CI, and a quick way to see the whole toolchain work before using it on your own game.

```sh
cp -R examples/minimal-game /tmp/minimal-game && cd /tmp/minimal-game
git init -q && npm install
bash ~/.claude/skills/web-game-kit/init-game.sh "Minimal Game" minimal_   # adds src/platform/, tools/e2e/, docs/store/
bash ~/.claude/skills/web-game-qa/run.sh                                  # 3 suites, all green
```

`src/platform/` is not committed here on purpose: `init-game.sh` creates it, which is part of what is tested.
