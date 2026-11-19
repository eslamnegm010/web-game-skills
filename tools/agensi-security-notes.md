## Security notes

- **No secrets, no telemetry.** Nothing reads credentials or sends data anywhere.
- **Deletes only its own output:** build folders (`dist-<portal>`, `release/`) and a frame or screenshot folder the user names or a temp folder. The QA runner refuses to empty a folder it did not create.
- **Network:** a local preview server on `localhost`, and headless Chrome talking to it over the DevTools protocol. Portal SDK URLs (CrazyGames, Y8, GamePix, Playgama) are loaded by the game in its own portal build, not by these scripts. Nothing is downloaded and run.
- **Processes:** it stops only the Chrome instances it started (`pkill`/`taskkill` matched to this run's own profile folder).
- **No installs, no system changes, no elevated permissions.** `npx vite` is only a fallback when the project's own Vite is not found in `node_modules`.
