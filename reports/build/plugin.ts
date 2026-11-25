import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { loadPosts } from "./posts.ts";
import { renderIndex, renderPost, renderSplashLinks, type Site } from "./render.ts";

const CONTENT = fileURLToPath(new URL("../content", import.meta.url));
const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".pdf": "application/pdf", ".csv": "text/csv", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * /reports/: turns reports/content into plain HTML pages, with no script of their own. A build writes
 * published posts only; the dev server also shows drafts, and re-reads the files on every request.
 */
export function reports(site: Site): Plugin {
  let drafts = false;
  return {
    name: "reports",
    configResolved(config) {
      drafts = config.command === "serve";
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const prefix = `${site.base}reports`;
        const url = (req.url ?? "").split("?")[0];
        if (url === prefix) return void res.writeHead(302, { Location: `${prefix}/` }).end();
        if (!url.startsWith(`${prefix}/`)) return next();
        try {
          const posts = loadPosts(CONTENT, { drafts: true });
          if (/%(?![0-9a-f]{2})/i.test(url)) return void res.writeHead(404).end("Not found");
          const [slug, name, ...rest] = url.slice(prefix.length + 1).split("/").map(decodeURIComponent);
          const post = posts.find((p) => p.slug === slug);
          const html = (text: string) => void res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(text);
          if (!slug && name === undefined) return html(renderIndex(posts, site));
          if (post && name === undefined) return void res.writeHead(302, { Location: `${url}/` }).end();
          if (post && name === "") return html(renderPost(post, site));
          if (post && !rest.length && post.files.includes(name)) {
            const type = TYPES[path.extname(name).toLowerCase()];
            return void res.writeHead(200, { "Content-Type": type }).end(readFileSync(path.join(post.dir, name)));
          }
          res.writeHead(404).end("Not found");
        } catch (error) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end((error as Error).message);
        }
      });
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        // Only the splash page has the marker.
        return html.includes("<!-- reports -->") ? html.replace("<!-- reports -->", () => renderSplashLinks(loadPosts(CONTENT, { drafts }), site)) : html;
      },
    },
    generateBundle() {
      const posts = loadPosts(CONTENT);
      const emit = (fileName: string, source: string | Uint8Array) => this.emitFile({ type: "asset", fileName: `reports/${fileName}`, source });
      emit("index.html", renderIndex(posts, site));
      for (const post of posts) {
        emit(`${post.slug}/index.html`, renderPost(post, site));
        for (const name of post.files) emit(`${post.slug}/${name}`, readFileSync(path.join(post.dir, name)));
      }
    },
  };
}
