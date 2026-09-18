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

    /**
     * GitHub Pages serves a project site from a subpath
     * (/gridsim_electricprotocol/), so assets need that prefix. The CI workflow
     * sets VITE_BASE from the repository name; a custom domain served at the
     * root only needs VITE_BASE=/ instead of a code change.
     */
    base: env.VITE_BASE || "/",

    /**
     * Four HTML entries, not the default single root one - the site root
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
        },
      },
    },

    test: {
      environment: "jsdom",
      globals: true,
    },
  };
});
