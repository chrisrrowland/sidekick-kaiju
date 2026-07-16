import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev playground only: aliases "mascot" to source so edits in src/ hot-reload
// instantly, without needing `npm run build` first.
export default defineConfig({
  root: "playground",
  plugins: [react()],
  resolve: {
    alias: {
      "mascot/react": fileURLToPath(new URL("./src/react/index.tsx", import.meta.url)),
      "mascot/styles.css": fileURLToPath(new URL("./styles/mascot.css", import.meta.url)),
      mascot: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
