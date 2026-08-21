// defineConfig comes from vitest so the `test` block typechecks; vitest/config
// does not re-export loadEnv, so that comes from vite itself.
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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

    test: {
      environment: "jsdom",
      globals: true,
    },
  };
});
