import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import type { Post } from "./posts.ts";

const CSS = readFileSync(fileURLToPath(new URL("./page.css", import.meta.url)), "utf8");

export interface Site {
  /** Vite's base, with its trailing slash. */
  base: string;
  /** e.g. https://electricfutures-prod.web.app, for link previews. Empty leaves those tags out. */
  url: string;
  /** Asks search engines to stay away (the dev site). */
  noindex: boolean;
}

export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateText = (date: string) => DATE.format(new Date(`${date}T00:00:00Z`));
const kindText = (post: Post) => (post.kind === "report" ? "Report" : "Blog post");

export const postPath = (post: Post, site: Site) => `${site.base}reports/${post.slug}/`;
const filePath = (post: Post, site: Site, name: string) => postPath(post, site) + encodeURIComponent(name);
const EXTERNAL = /^(https?:|mailto:|tel:|\/\/|#)/i;

/** The post's Markdown as HTML. HTML in the Markdown is shown as text, not run. */
export function renderBody(post: Post, site: Site): string {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  const fail = (message: string): never => {
    throw new Error(`reports/content/${post.slug}: ${message}`);
  };
  /** Files beside index.md become full addresses; a name that is not there fails the build. */
  const local = (href: string): string => {
    const [name, hash] = href.split("#", 2);
    let decoded = "";
    try {
      decoded = decodeURIComponent(name.replace(/^\.\//, ""));
    } catch {
      fail(`the address ${href} has a stray % in it`);
    }
    if (!post.files.includes(decoded)) fail(`the text uses ${href}, which is not in the folder`);
    return filePath(post, site, decoded) + (hash ? `#${hash}` : "");
  };

  md.renderer.rules.link_open = (tokens, i, options, _env, self) => {
    const href = String(tokens[i].attrGet("href") ?? "");
    // An address from the top of the site (/policy/) has to allow for the site's base.
    if (/^\/(?!\/)/.test(href)) tokens[i].attrSet("href", site.base + href.slice(1));
    else if (!EXTERNAL.test(href)) tokens[i].attrSet("href", local(href));
    return self.renderToken(tokens, i, options);
  };
  md.renderer.rules.image = (tokens, i) => {
    const token = tokens[i];
    const src = String(token.attrGet("src") ?? "");
    if (EXTERNAL.test(src) || src.startsWith("/")) fail(`put the image ${src} in the post's folder instead of linking to it`);
    const alt = md.renderer.renderInlineAsText(token.children ?? [], md.options, {}).trim();
    if (!alt) fail(`the image ${src} needs a description: ![what it shows](${src})`);
    const caption = token.attrGet("title");
    const img = `<img src="${esc(local(src))}" alt="${esc(alt)}" loading="lazy" />`;
    return caption ? `${img}<span class="caption">${esc(String(caption))}</span>` : img;
  };
  // The page's title is its only h1.
  md.core.ruler.push("no_h1", (state) => {
    if (state.tokens.some((t) => t.type === "heading_open" && t.tag === "h1")) fail('start headings at "##": the title is already the top heading');
  });
  md.renderer.rules.table_open = () => '<div class="table" role="region" aria-label="Table" tabindex="0"><table>\n';
  md.renderer.rules.table_close = () => "</table></div>\n";
  return md.render(post.markdown);
}

interface Head {
  title: string;
  description: string;
  path: string;
  type: "website" | "article";
  image?: string;
  noindex: boolean;
}

function page(site: Site, head: Head, body: string): string {
  const meta = [
    `<meta name="description" content="${esc(head.description)}" />`,
    `<meta property="og:type" content="${head.type}" />`,
    `<meta property="og:site_name" content="Electric Futures Playbook" />`,
    `<meta property="og:title" content="${esc(head.title)}" />`,
    `<meta property="og:description" content="${esc(head.description)}" />`,
    `<meta name="twitter:card" content="${head.image && site.url ? "summary_large_image" : "summary"}" />`,
  ];
  if (site.url) {
    meta.push(`<link rel="canonical" href="${esc(site.url + head.path)}" />`, `<meta property="og:url" content="${esc(site.url + head.path)}" />`);
    if (head.image) meta.push(`<meta property="og:image" content="${esc(site.url + head.image)}" />`);
  }
  if (head.noindex) meta.push('<meta name="robots" content="noindex" />');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="icon" type="image/png" href="${site.base}favicon.png" />
<title>${esc(head.title)}</title>
${meta.join("\n")}
<style>
${CSS.replaceAll("url('/fonts/", `url('${site.base}fonts/`)}</style>
</head>
<body>
<a class="skip" href="#content">Skip to the text</a>
<header class="site">
  <a href="${site.base}"><img src="${site.base}favicon.png" alt="" />Electric Futures Playbook</a>
  <a href="${site.base}reports/">Reports and blog</a>
</header>
${body}
<footer class="site">The Global Solar Council</footer>
</body>
</html>
`;
}

export function renderIndex(posts: Post[], site: Site): string {
  const items = posts.map(
    (post) => `  <li>
    <div class="when"><span class="kind ${post.kind}">${kindText(post)}</span><time datetime="${post.date}">${dateText(post.date)}</time></div>
    <div class="what">
      <h2><a href="${esc(postPath(post, site))}">${esc(post.title)}</a>${post.draft ? ' <span class="draft">Draft</span>' : ""}</h2>
      <p>${esc(post.summary)}</p>
    </div>${post.cover ? `\n    <img src="${esc(filePath(post, site, post.cover))}" alt="" loading="lazy" />` : ""}
  </li>`,
  );
  const list = items.length ? `<ul class="posts">\n${items.join("\n")}\n</ul>` : '<p class="empty">Nothing has been published yet.</p>';
  return page(
    site,
    {
      title: "Reports and blog | Electric Futures Playbook",
      description: "Reports and articles on solar and storage from the Global Solar Council.",
      path: `${site.base}reports/`,
      type: "website",
      noindex: site.noindex || !items.length,
    },
    `<div class="masthead"><h1>Reports and blog</h1></div>
<main id="content" class="list">
${list}
</main>`,
  );
}

export function renderPost(post: Post, site: Site): string {
  const pdf = post.pdf ? `\n  <p><a class="pdf" href="${esc(filePath(post, site, post.pdf))}">Download the PDF</a></p>` : "";
  const cover = post.cover ? `\n<img class="cover" src="${esc(filePath(post, site, post.cover))}" alt="${esc(post.coverAlt)}" />` : "";
  const sources = post.sources.length
    ? `\n<section class="sources" aria-labelledby="sources"><h2 id="sources">Sources</h2>\n<ul>\n${post.sources
        .map((s) => `<li>${s.url ? `<a href="${esc(s.url)}">${esc(s.label)}</a>` : esc(s.label)}</li>`)
        .join("\n")}\n</ul></section>`
    : "";
  return page(
    site,
    {
      title: `${post.title} | Electric Futures Playbook`,
      description: post.summary,
      path: postPath(post, site),
      type: "article",
      image: post.cover && filePath(post, site, post.cover),
      noindex: site.noindex || post.draft,
    },
    `<div class="masthead">
  <p class="when"><span class="kind ${post.kind}">${kindText(post)}</span><time datetime="${post.date}">${dateText(post.date)}</time>${post.draft ? '<span class="draft">Draft</span>' : ""}</p>
  <h1>${esc(post.title)}</h1>
  <p class="summary">${esc(post.summary)}</p>${post.authors.length ? `\n  <p class="authors">${esc(new Intl.ListFormat("en-GB").format(post.authors))}</p>` : ""}${pdf}
</div>
<main id="content" class="article">${cover}
${renderBody(post, site)}${sources}
</main>`,
  );
}

/** The splash page's list of the newest posts; nothing at all until something is published. */
export function renderSplashLinks(posts: Post[], site: Site): string {
  if (!posts.length) return "";
  const links = posts.slice(0, 3).map((post) => `<li><a href="${esc(postPath(post, site))}">${esc(post.title)}</a></li>`);
  return `<nav class="reading" aria-labelledby="reading-title">
      <h2 id="reading-title">Reports and blog</h2>
      <ul>${links.join("")}</ul>
      <a class="all" href="${site.base}reports/">See all</a>
    </nav>`;
}
