# Changelog

## 1.1.0

Fixes found in a pre-release review, and a test suite that runs the whole toolchain on macOS, Linux and Windows.

**Windows**
- Portal builds use `vite build --mode <portal>` instead of a `VITE_PLATFORM=<portal>` script prefix, which `cmd.exe` (npm's script shell on Windows) cannot run. `platformHtml()` now reads the portal from the mode and also sets the build options; `platformBuild()` and `VITE_PLATFORM` keep working for existing projects.
- The browser suites import their helpers by `file://` URL (a bare `C:\` path is not a valid ESM import). `with-preview.sh` exports `WEB_GAME_CAPTURE` the same way for your own scripts.
- `cut.sh` reads frames as a numbered sequence: Windows builds of ffmpeg have no glob input.
- `with-preview.sh` starts Vite's preview server directly, so stopping it stops the server everywhere.
- `title-cover.sh` runs the cover script with a Python 3 that really works (Windows Store stubs are skipped).
- Scripts are executable in git, so "Permission denied" after a clone is gone.

**Bugs**
- CrazyGames adapter: an ad that started after the request had timed out paused and muted the game forever. `onAdEnd` now fires only after `onAdStart`.
- `platform.init()` has the timeout the docs promised (`initTimeout` in `config.js`, 12 s).
- `title-cover.py` accepts `#rgb` and `#rrggbbaa` colours (the documented example crashed).
- The starter suites open the game with `?debug`, where the docs tell games to expose `window.__game`.

**Safety**
- `run.sh` writes to `WEB_GAME_QA_OUT` (`OUT` still works) and only empties a folder it made itself; it closes only its own browsers, never another run's or a trailer being filmed.
- Chrome, Chromium or Edge is also found on `PATH`, in `/snap/bin`, and Edge on macOS and Linux.

**Docs and skills**
- Paths use `${CLAUDE_SKILL_DIR}`, so the skills work wherever they are installed.
- `game-code-review` is scoped to web games, with no references to skills outside this set.
- Skills no longer tell Claude to edit the installed skill files: project knowledge goes into the project, shared fixes go upstream as pull requests.
- Portal rules live in one place (the portal's reference) instead of four.
- `examples/minimal-game`, `tests/run.sh` and CI on three operating systems; MIT `LICENSE` at the root.

## 1.0.0

First public release: kit, capture, QA, trailer, store assets, portals and code review.
