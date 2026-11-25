import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import { parseChart, type Chart } from "./chart.ts";
import type { Post } from "./posts.ts";

const CSS = readFileSync(fileURLToPath(new URL("./page.css", import.meta.url)), "utf8");
const CHART_SCRIPT = readFileSync(fileURLToPath(new URL("./chart.client.js", import.meta.url)), "utf8");

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
const NUMBER = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 10 });
const dateText = (date: string) => DATE.format(new Date(`${date}T00:00:00Z`));
const kindText = (post: Post) => (post.kind === "report" ? "Report" : "Blog post");

export const postPath = (post: Post, site: Site) => `${site.base}reports/${post.slug}/`;
const filePath = (post: Post, site: Site, name: string) => postPath(post, site) + encodeURIComponent(name);
const EXTERNAL = /^(https?:|mailto:|tel:|\/\/|#)/i;

/** Ids the page itself uses. A heading's id has no "_" in it, so it can't clash with src_1 or cite_1 either. */
const OWN_IDS = ["content", "sources"];
const CITE = /\[\^(\d+(?:\s*,\s*\d+)*)\]/;

interface Body {
  html: string;
  /** The "##" headings, for the list of contents. */
  headings: { id: string; text: string }[];
  /** The sources the text cites, by number. */
  cited: Set<number>;
  hasChart: boolean;
}

export const renderBody = (post: Post, site: Site): string => readBody(post, site).html;

/** The post's Markdown as HTML. HTML in the Markdown is shown as text, not run. */
function readBody(post: Post, site: Site): Body {
  const headings: Body["headings"] = [];
  const cited: Body["cited"] = new Set();
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

  /** "[^1]" or "[^1, 3]": links to those numbers in the post's list of sources. The first link to each is where its way back goes. */
  const cite = (list: string): string =>
    `<sup class="cite">[${list
      .split(",")
      .map((item) => {
        const n = Number(item);
        if (n < 1 || n > post.sources.length) fail(`the text cites source ${n}, but "sources" lists ${post.sources.length}`);
        const id = cited.has(n) ? "" : ` id="cite_${n}"`;
        cited.add(n);
        return `<a${id} href="#src_${n}" aria-label="Source ${n}">${n}</a>`;
      })
      .join(", ")}]</sup>`;
  const footnote = () => fail('list the sources in the details block, under "sources", not in the text');
  // Takes out every closed [...], leaving the brackets that are still open.
  const unclosed = (text: string): string => {
    let rest = text.replace(/\\[[\]]/g, "");
    while (/\[[^[\]]*\]/.test(rest)) rest = rest.replace(/\[[^[\]]*\]/g, "");
    return rest;
  };
  md.inline.ruler.before("link", "cite", (state, silent) => {
    if (!state.src.startsWith("[^", state.pos)) return false;
    const match = CITE.exec(state.src.slice(state.pos));
    if (!match || match.index !== 0) return fail("a citation is a source's number: [^1], or [^1, 3] for two");
    // markdown-it won't nest these, so the outer link would come out as text.
    const before = state.src.slice(0, state.pos);
    const after = state.src.slice(state.pos + match[0].length);
    if (unclosed(before).includes("[") && /^[^[\]]*\]\(/.test(unclosed(after))) return fail(`put ${match[0]} after the link or image, not inside its square brackets`);
    if (/(^|\n)$/.test(before) && after.startsWith(":")) return footnote();
    if (!silent) state.push("cite", "", 0).content = match[1];
    state.pos += match[0].length;
    return true;
  });
  md.renderer.rules.cite = (tokens, i) => cite(tokens[i].content);

  md.renderer.rules.link_open = (tokens, i, options, _env, self) => {
    const href = String(tokens[i].attrGet("href") ?? "");
    if (tokens[i].markup === "linkify" && /\[\^|%5B%5E/i.test(href)) fail(`put a space between the address ${href.replace(/(\[\^|%5B%5E).*/i, "")} and the citation after it`);
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
    let img = `<img src="${esc(local(src))}" alt="${esc(alt)}" loading="lazy" />`;
    // Charts are drawn larger than the column: open the file to read the small print. Not if it is already a link.
    const before = tokens.slice(0, i).map((t) => t.type);
    const inLink = before.lastIndexOf("link_open") > before.lastIndexOf("link_close");
    if (!inLink) img = `<a class="zoom" href="${esc(local(src))}">${img}</a>`;
    if (inLink && caption && CITE.test(String(caption))) fail(`the caption of ${src} can't cite a source, because the image is a link`);
    return caption ? img + captionHtml(String(caption)) : img;
  };
  // The page's title is its only h1.
  md.core.ruler.push("no_h1", (state) => {
    if (state.tokens.some((t) => t.type === "heading_open" && t.tag === "h1")) fail('start headings at "##": the title is already the top heading');
  });
  // A caption's text, with its citations. Anywhere but inside a link.
  const captionHtml = (text: string): string => `<span class="caption">${esc(text).replace(new RegExp(CITE, "g"), (_, list) => cite(list))}</span>`;
  let hasChart = false;
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, i, options, env, self) => {
    if (tokens[i].info.trim() !== "chart") return fence(tokens, i, options, env, self);
    hasChart = true;
    const chart = parseChart(
      tokens[i].content,
      (name) => (post.files.includes(name) ? readFileSync(path.join(post.dir, name), "utf8") : fail(`a chart uses ${name}, which is not in the folder`)),
      fail,
    );
    return chartHtml(chart, chart.file && filePath(post, site, chart.file), chart.caption && captionHtml(chart.caption));
  };
  const ids = new Set(OWN_IDS);
  md.core.ruler.push("heading_ids", (state) => {
    state.tokens.forEach((open, i) => {
      if (open.type !== "heading_open") return;
      const children = state.tokens[i + 1].children ?? [];
      if (children.some((t) => t.type === "cite")) fail("cite sources in the text, not in a heading");
      const text = children.map((t) => (/break$/.test(t.type) ? " " : t.content)).join("").trim();
      const slug = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, "-").replace(/^-|-$/g, "") || "section";
      let id = slug;
      for (let n = 2; ids.has(id); n++) id = `${slug}-${n}`;
      ids.add(id);
      open.attrSet("id", id);
      // The heading is a link to itself, unless it already has a link in it.
      open.meta = state.tokens[i + 2].meta = { self: !children.some((t) => t.type === "link_open" || t.type === "image") };
      if (open.tag === "h2") headings.push({ id, text });
    });
  });
  md.renderer.rules.heading_open = (tokens, i, options, _env, self) =>
    self.renderToken(tokens, i, options) + (tokens[i].meta?.self ? `<a class="self" href="#${esc(String(tokens[i].attrGet("id")))}">` : "");
  md.renderer.rules.heading_close = (tokens, i, options, _env, self) => (tokens[i].meta?.self ? "</a>" : "") + self.renderToken(tokens, i, options);
  md.renderer.rules.table_open = () => '<div class="table" role="region" aria-label="Table" tabindex="0"><table>\n';
  md.renderer.rules.table_close = () => "</table></div>\n";
  const env: Parameters<typeof md.render>[1] = {};
  const html = md.render(post.markdown, env);
  if (Object.keys(env?.references ?? {}).some((name) => name.startsWith("^"))) footnote();
  return { html, headings, cited, hasChart };
}

/** A chart's frame, its numbers as a table, and the data the page's script draws it from. */
function chartHtml(chart: Chart, href: string | undefined, caption: string): string {
  const { type, stacked, unit, labels, series } = chart;
  // "<" is escaped so that a label can't end the script element.
  const data = JSON.stringify({ type, stacked, unit, labels, series }).replace(/</g, "\\u003c");
  const shape = type === "line" ? "line" : "box";
  const key = series.length > 1 ? `<ul class="key-list">${series.map((s, i) => `<li><span class="key ${shape} s${i + 1}"></span>${esc(s.name)}</li>`).join("")}</ul>` : "";
  const head = [chart.axis, ...series.map((s) => s.name)].map((h) => `<th scope="col">${esc(h)}</th>`).join("");
  const rows = labels.map((l, i) => `<tr><th scope="row">${esc(l)}</th>${series.map((s) => `<td>${s.values[i] === null ? "No data" : NUMBER.format(s.values[i])}</td>`).join("")}</tr>`).join("");
  return `<figure class="chart">
<p class="title">${esc(chart.title)}</p>
${unit ? `<p class="unit">${esc(unit)}</p>` : ""}${key}
<div class="plot ${type}" tabindex="0" role="group" aria-label="${esc(`Chart: ${chart.description} Use the arrow keys to read the values.`)}"></div>
<script type="application/json">${data}</script>
<details class="data"><summary>Show the numbers</summary><div class="table" role="region" aria-label="${esc(chart.title)}" tabindex="0"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>${href ? `<p><a href="${esc(href)}">Download as CSV</a></p>` : ""}</details>
${caption}</figure>
`;
}

interface Head {
  title: string;
  description: string;
  path: string;
  type: "website" | "article";
  image?: string;
  noindex: boolean;
}

function page(site: Site, head: Head, body: string, script = ""): string {
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
${script && `<script>\n${script}</script>\n`}</body>
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
  const body = readBody(post, site);
  const pdf = post.pdf ? `\n    <a class="pdf" href="${esc(filePath(post, site, post.pdf))}">Download the PDF</a>` : "";
  const authors = post.authors.length ? `\n    <span class="authors">${esc(new Intl.ListFormat("en-GB").format(post.authors))}</span>` : "";
  const byline = authors || pdf ? `\n  <div class="byline">${authors}${pdf}\n  </div>` : "";
  const cover = post.cover ? `\n  <img class="cover" src="${esc(filePath(post, site, post.cover))}" alt="${esc(post.coverAlt)}" />` : "";
  const sources = post.sources.length
    ? `\n<section class="sources" aria-labelledby="sources"><h2 id="sources">Sources</h2>\n<ol>\n${post.sources
        .map((s, i) => {
          const n = i + 1;
          const back = body.cited.has(n) ? ` <a class="back" href="#cite_${n}" aria-label="Back to the text that cites source ${n}">↩</a>` : "";
          return `<li id="src_${n}">${s.url ? `<a href="${esc(s.url)}">${esc(s.label)}</a>` : esc(s.label)}${back}</li>`;
        })
        .join("\n")}\n</ol></section>`
    : "";
  // Beside the text where there is room for it, and folded up above it where there isn't (page.css shows one of the two).
  const long = body.headings.length >= 3;
  const list = `<ul>${[...body.headings, ...(sources ? [{ id: "sources", text: "Sources" }] : [])]
    .map((h) => `<li><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`)
    .join("")}</ul>`;
  const contents = long
    ? `<nav class="contents" aria-label="Contents"><p>Contents</p>${list}</nav>
<nav class="contents-fold" aria-label="Contents"><details><summary>Contents</summary>${list}</details></nav>
`
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
    `<div class="masthead post${long ? "" : " short"}${cover ? " with-cover" : ""}">
  <div>
  <p class="when"><span class="kind ${post.kind}">${kindText(post)}</span><time datetime="${post.date}">${dateText(post.date)}</time>${post.draft ? '<span class="draft">Draft</span>' : ""}</p>
  <h1>${esc(post.title)}</h1>
  <p class="summary">${esc(post.summary)}</p>${byline}
  </div>${cover}
</div>
<main id="content" class="${long ? "long" : "short"}">
${contents}<div class="article">
${body.html}${sources}
</div>
</main>`,
    body.hasChart ? CHART_SCRIPT : "",
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
