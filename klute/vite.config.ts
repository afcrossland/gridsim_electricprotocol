import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// /klute/ on its own, for the sign-in gate's image (klute/gate/Dockerfile). The root stays
// the repo root so klute/index.html's /klute/src/main.tsx and the shared imports resolve the
// same as in dev; assets go under klute/ so the gate can serve dist-klute/klute/ as /klute/.
export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  plugins: [react()],
  base: "/",
  // favicon etc. come from public hosting at the site root.
  publicDir: false,
  build: {
    outDir: "dist-klute",
    emptyOutDir: true,
    assetsDir: "klute/assets",
    rollupOptions: {
      input: { klute: fileURLToPath(new URL("./index.html", import.meta.url)) },
    },
  },
});
