// defineConfig comes from vitest so the `test` block typechecks; vitest/config
// does not re-export loadEnv, so that comes from vite itself.
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],

    // The report writer (shared/pdf/renderPdf.ts) is loaded on demand. Without this, the dev server only discovers
    // pdfkit and pdfjs-dist when the first report is requested, re-optimises, and that first request fails ("Failed to fetch
    // dynamically imported module"). Pre-bundling it up front avoids that.
    optimizeDeps: { include: ["pdfkit", "pdfjs-dist"] },

    /**
     * Firebase Hosting serves the site at the root, so VITE_BASE is normally
     * unset. It is still configurable for hosting under a subpath (as the old
     * GitHub Pages project site did) without a code change.
     */
    base: env.VITE_BASE || "/",

    /**
     * Four public HTML entries, not the default single root one - the site root
     * is the static Electric Futures Playbook splash (`index.html`, no JS
     * bundle of its own), the Solar Policy Explorer app lives at `/policy/`,
     * the Solar Deployment Explorer app (moved in from the standalone
     * ep_deploymentexplorer project, 2026-09-09) lives at `/deployment/`,
     * and the Solar Homes Calculator (moved in from the standalone
     * ep_solarCalculator project the same way, 2026-09-15 - it started as
     * its own separate project with a dev-server proxy bridging the two,
     * but Andrew wanted this back down to one dev server, so it moved in
     * here instead) lives at `/calculator/`. All four still get the same
     * `base` prefix above regardless of where their own HTML file sits in
     * the output tree. `/deployment/` and `/calculator/` each have their
     * own `src/` tree, separate from this project's root `src/` (which the
     * policy app itself uses) - three different apps, so none of them can
     * share one `main.tsx`.
     */
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          policy: fileURLToPath(new URL("./policy/index.html", import.meta.url)),
          deployment: fileURLToPath(new URL("./deployment/index.html", import.meta.url)),
          calculator: fileURLToPath(new URL("./calculator/index.html", import.meta.url)),
          // /klute/ is deliberately not here: it is built on its own (klute/vite.config.ts)
          // into the sign-in gate's image, so it never lands on public hosting.
        },
      },
    },

    /**
     * The dev server still serves /klute/ (any HTML file under the root works in dev). In
     * production the sign-in gate proxies /klute/api/* to the simulator and adds the klute
     * password; locally this does the same, reading the password from the shell
     * (KLUTE_PASSWORD - not VITE_-prefixed, so it never reaches the bundle).
     */
    server: {
      proxy: {
        "/klute/api": {
          target: env.FGS_API_BASE_URL || "http://localhost:8000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/klute\/api/, ""),
          headers: { "X-Klute-Password": env.KLUTE_PASSWORD ?? "" },
        },
      },
    },

    test: {
      environment: "jsdom",
      globals: true,
    },
  };
});
