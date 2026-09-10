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
     * Three HTML entries, not the default single root one - the site root
     * is the static Electric Futures Playbook splash (`index.html`, no JS
     * bundle of its own), the Solar Policy Explorer app lives at `/policy/`,
     * and the Solar Deployment Explorer app (moved in from the standalone
     * ep_deploymentexplorer project, 2026-09-09, so everything serves from
     * one dev server on one port) lives at `/deployment/`. All three still
     * get the same `base` prefix above regardless of where their own HTML
     * file sits in the output tree. `/deployment/` has its own `src/` tree
     * (`deployment/src/`), separate from this project's root `src/` (which
     * the policy app itself uses) - two different apps, so they can't share
     * one `main.tsx`.
     */
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          policy: fileURLToPath(new URL("./policy/index.html", import.meta.url)),
          deployment: fileURLToPath(new URL("./deployment/index.html", import.meta.url)),
        },
      },
    },

    test: {
      environment: "jsdom",
      globals: true,
    },
  };
});
