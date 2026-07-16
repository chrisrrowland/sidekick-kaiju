import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev playground only: aliases "sidekick-kaiju" to source so edits in src/ hot-reload
// instantly, without needing `npm run build` first.
export default defineConfig(({ command }) => ({
  root: "playground",
  // The dev server serves from "/"; the built site is published to GitHub Pages as a
  // project site (github.io/sidekick-kaiju/, not the domain root), so only the
  // production build needs the subpath prefix on every asset URL. `vite preview`
  // reports the same command ("serve") as dev, so it can't be distinguished here —
  // `preview:playground` passes `--base` explicitly on the CLI instead to match what
  // `build:playground` already baked into the output.
  base: command === "build" ? "/sidekick-kaiju/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "sidekick-kaiju/react": fileURLToPath(new URL("./src/react/index.tsx", import.meta.url)),
      "sidekick-kaiju/styles.css": fileURLToPath(new URL("./styles/sidekick.css", import.meta.url)),
      "sidekick-kaiju": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
}));
