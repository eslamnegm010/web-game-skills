import { defineConfig } from "vite";
import { platformHtml } from "./src/platform/vite.js";

// src/platform/ is created by init-game.sh (web-game-kit): see README.md.
export default defineConfig({ base: "./", plugins: [platformHtml()] });
