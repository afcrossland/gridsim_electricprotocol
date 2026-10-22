// defineConfig comes from vitest so the `test` block typechecks; vitest/config
// does not re-export loadEnv, so that comes from vite itself.
import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * The Policy Explorer's data-driven start (src/main.tsx) is a chain: entry script -> fetch the policy
 * data -> only then import the app. On builds that read the database (VITE_POLICY_API), this adds two
 * hints to policy/index.html so those steps overlap instead of queueing:
 *  - the data request starts with the HTML, not once the entry script has run;
 *  - the app's chunks download while the data does. `modulepreload` fetches without running them, so
 *    the "import the app only after the data has settled" rule in main.tsx still holds.
 */
function policyLoadHints(enabled: boolean, base: string): Plugin {
  return {
    name: "policy-load-hints",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        if (!enabled || !ctx.bundle || !ctx.filename.endsWith("policy/index.html")) return;
        const bundle = ctx.bundle;
        const entry = Object.values(bundle).find((c) => c.type === "chunk" && c.isEntry && c.facadeModuleId === ctx.filename);
        const app = Object.values(bundle).find((c) => c.type === "chunk" && c.isDynamicEntry && /\/src\/App\.tsx$/.test(c.facadeModuleId ?? ""));
        if (!entry || entry.type !== "chunk" || !app || app.type !== "chunk") return;

        // The app's chunk and everything it statically imports, minus what the entry already loads.
        const wanted = new Set<string>();
        const visit = (file: string) => {
          const chunk = bundle[file];
          if (wanted.has(file) || !chunk || chunk.type !== "chunk") return;
          wanted.add(file);
          chunk.imports.forEach(visit);
        };
        visit(app.fileName);
        const alreadyLoaded = new Set<string>();
        const loaded = (file: string) => {
          const chunk = bundle[file];
          if (alreadyLoaded.has(file) || !chunk || chunk.type !== "chunk") return;
          alreadyLoaded.add(file);
          chunk.imports.forEach(loaded);
        };
        loaded(entry.fileName);

        return [
          // crossorigin matches fetch()'s default credentials mode, or the browser would not reuse the response.
          { tag: "link" as const, attrs: { rel: "preload", as: "fetch", href: `${base}api/policy/data`, crossorigin: "anonymous" }, injectTo: "head" as const },
          ...[...wanted]
            .filter((file) => !alreadyLoaded.has(file))
            .map((file) => ({ tag: "link" as const, attrs: { rel: "modulepreload", crossorigin: "", href: `${base}${file}` }, injectTo: "head" as const })),
        ];
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE || "/";

  return {
    plugins: [react(), policyLoadHints(!!env.VITE_POLICY_API, base)],

    // The report writer (shared/pdf/renderPdf.ts) is loaded on demand. Without this, the dev server only discovers
    // pdfkit and pdfjs-dist when the first report is requested, re-optimises, and that first request fails ("Failed to fetch
    // dynamically imported module"). Pre-bundling it up front avoids that.
    optimizeDeps: { include: ["pdfkit", "pdfjs-dist"] },

    /**
     * Firebase Hosting serves the site at the root, so VITE_BASE is normally
     * unset. It is still configurable for hosting under a subpath (as the old
     * GitHub Pages project site did) without a code change.
     */
    base,

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
        // The Policy Explorer's data API (ROADMAP.md Phase 1), only used when VITE_POLICY_API is
        // set. Run the gate locally (uvicorn main:app --port 8080 in klute/gate, with DATABASE_URL).
        "/api/policy": {
          target: env.EP_API_BASE_URL || "http://localhost:8080",
          changeOrigin: true,
        },
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
