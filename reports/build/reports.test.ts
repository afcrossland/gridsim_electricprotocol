// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPosts, parsePost, readPost } from "./posts.ts";
import { renderBody, renderIndex, renderPost, renderSplashLinks, renderSplashTop, type Site } from "./render.ts";

const SITE: Site = { base: "/", url: "https://site.test", noindex: false };
const DETAILS = { title: "A title", kind: "report", date: "2026-11-24", summary: "A summary" };

function text(details: Record<string, unknown> = {}, body = "Hello") {
  const lines = Object.entries({ ...DETAILS, ...details }).filter(([, v]) => v !== undefined);
  return `---\n${lines.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n")}\n---\n${body}`;
}
const post = (details: Record<string, unknown> = {}, body?: string, files: string[] = [], slug = "a-post") => parsePost(slug, "/x", text(details, body), files);

describe("reading posts", () => {
  it("accepts an unquoted date and a post written on Windows", () => {
    const p = parsePost("a", "/x", "---\r\ntitle: T\r\nkind: blog\r\ndate: 2026-01-02\r\nsummary: S\r\n---\r\nBody\r\n", []);
    expect(p).toMatchObject({ title: "T", kind: "blog", date: "2026-01-02", draft: false });
  });

  it.each([
    ["a missing title", { title: undefined }, '"title" is missing'],
    ["a wrong kind", { kind: "news" }, '"kind"'],
    ["a date that does not exist", { date: "2026-02-30" }, '"date"'],
    ["a long summary", { summary: "x".repeat(281) }, '"summary"'],
    ["a misspelt detail", { drft: true }, 'unknown detail "drft"'],
    ["a draft that is not true or false", { draft: "yes" }, '"draft"'],
    ["a draft left blank, which would otherwise publish it", { draft: null }, '"draft"'],
    ["a title of only spaces", { title: "   " }, '"title" is missing'],
    ["a cover nobody has described", { cover: "c.jpg" }, '"coverAlt"'],
    ["a cover that is not there", { cover: "c.jpg" }, "not in the folder"],
    ["a PDF outside the folder", { pdf: "../x.pdf" }, "not in the folder"],
    ["a script as a source link", { sources: [{ label: "x", url: "javascript:alert(1)" }] }, '"sources"'],
  ])("refuses %s", (_what, details, message) => {
    expect(() => post(details)).toThrow(message);
  });

  it("accepts a byte-order mark, and spaces after the dashes", () => {
    expect(parsePost("a", "/x", "\uFEFF" + text().replace(/---\n/g, "---  \n"), []).title).toBe("A title");
  });

  it("refuses a bad folder name, files that would not be published, and a page without details", () => {
    expect(() => post({}, "x", [], "Bad_Name")).toThrow("folder name");
    expect(() => post({}, "x", ["notes.docx"])).toThrow("notes.docx");
    expect(() => parsePost("a", "/x", "Hello", [])).toThrow("---");
  });

  it("orders newest first, and leaves out drafts and _folders", () => {
    const root = mkdtempSync(path.join(tmpdir(), "reports-"));
    const add = (slug: string, details: Record<string, unknown>) => {
      mkdirSync(path.join(root, slug));
      writeFileSync(path.join(root, slug, "index.md"), text(details));
    };
    add("old", { date: "2025-01-01" });
    add("new", { date: "2026-01-01" });
    add("secret", { draft: true });
    add("_template", {});
    expect(loadPosts(root).map((p) => p.slug)).toEqual(["new", "old"]);
    expect(loadPosts(root, { drafts: true }).map((p) => p.slug)).toEqual(["secret", "new", "old"]);
  });

  it("keeps the example, and everything published, valid", () => {
    const content = fileURLToPath(new URL("../content", import.meta.url));
    renderPost(readPost(content, "_example"), SITE);
    for (const p of loadPosts(content, { drafts: true })) renderPost(p, SITE);
  });
});

describe("pages", () => {
  it("shows HTML as text and drops script links", () => {
    const html = renderBody(post({}, "<script>x</script>\n\n[go](javascript:alert(1))"), SITE);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("href=\"javascript");
  });

  it("escapes details", () => {
    const html = renderPost(post({ title: '<b>"T"</b>', summary: "a & b", authors: ["<i>"] }), SITE);
    expect(html).toContain("&lt;b&gt;&quot;T&quot;&lt;/b&gt;");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<i>");
  });

  it("points images and files at their published address, under the site's base", () => {
    const p = post({ pdf: "full report.pdf" }, '![A chart](chart.png "Source: X")\n\n[data](data.csv)', ["chart.png", "data.csv", "full report.pdf"]);
    const html = renderPost(p, { ...SITE, base: "/sub/" });
    expect(html).toContain('src="/sub/reports/a-post/chart.png" alt="A chart"');
    expect(html).toContain('<span class="caption">Source: X</span>');
    expect(html).toContain('href="/sub/reports/a-post/data.csv"');
    expect(html).toContain('href="/sub/reports/a-post/full%20report.pdf"');
    expect(html).toContain("url('/sub/fonts/");
  });

  it("uses plain words for a formatted description, and keeps site links under the base", () => {
    const html = renderBody(post({}, "![a *chart* of **y**](c.png)\n\n[p](/policy/) [w](//a.test/) [t](tel:+1)", ["c.png"]), { ...SITE, base: "/sub/" });
    expect(html).toContain('alt="a chart of y"');
    expect(html).toContain('href="/sub/policy/"');
    expect(html).toContain('href="//a.test/"');
    expect(html).toContain('href="tel:+1"');
  });

  it.each([
    ["an address with a stray %", "[x](a%80.pdf)", "stray %"],
    ["an image from the top of the site", "![x](/x.png)", "folder"],
    ["a missing image", "![x](nope.png)", "nope.png"],
    ["an image from another site", "![x](https://a.test/x.png)", "folder"],
    ["an image with no description", "![](chart.png)", "description"],
    ["a link to a missing file", "[x](nope.pdf)", "nope.pdf"],
    ["a second top heading", "# Title again", "##"],
  ])("refuses %s", (_what, body, message) => {
    expect(() => renderBody(post({}, body, ["chart.png"]), SITE)).toThrow(message);
  });

  const SOURCES = { sources: [{ label: "One", url: "https://a.test/" }, { label: "Two" }, { label: "Three" }] };

  it("numbers sources, links citations to them, and gives the first citation the way back", () => {
    const html = renderPost(post(SOURCES, 'A.[^1] B.[^1, 3] `[^9]`\n\n![c](c.png "Source.[^2]")', ["c.png"]), SITE);
    expect(html).toContain('A.<sup class="cite">[<a id="cite_1" href="#src_1" aria-label="Source 1">1</a>]</sup>');
    expect(html).toContain('B.<sup class="cite">[<a href="#src_1" aria-label="Source 1">1</a>, <a id="cite_3"');
    expect(html).toContain('Source.<sup class="cite">[<a id="cite_2"');
    expect(html).toContain("<code>[^9]</code>");
    expect(html.match(/<li id="src_\d">/g)).toHaveLength(3);
    expect(html.match(/class="back"/g)).toHaveLength(3);
    expect(renderPost(post(SOURCES, "No citations"), SITE)).not.toContain('class="back"');
  });

  it.each([
    ["a source that is not listed", "x[^4]", "source 4"],
    ["source 0", "x[^0]", "source 0"],
    ["a citation that is not a number", "x[^ember]", "number"],
    ["a citation inside a link", "[x [^1]](https://a.test/)", "after the link"],
    ["a citation in a heading", "## x[^1]", "heading"],
    ["a second citation inside a link", "[x [^1] [^2]](https://a.test/)", "after the link"],
    ["a citation in an image's description", "![x [^1]](c.png)", "after the link or image"],
    ["a citation touching a bare address", "https://a.test/data[^1]", "put a space"],
    ["a citation in the caption of an image that is a link", '[![x](c.png "y[^1]")](https://a.test/)', "caption"],
    ["a one-word footnote in the text", "x[^1]\n\n[^1]: Note", "details block"],
    ["a footnote written in the text", "x[^1]\n\n[^1]: A note", "details block"],
  ])("refuses %s", (_what, body, message) => {
    expect(() => renderPost(post(SOURCES, body, ["c.png"]), SITE)).toThrow(message);
  });

  it("leaves brackets alone that only look like a link or a footnote", () => {
    const html = renderPost(post(SOURCES, "```\n[^1]: note\n```\n\nx [^1](u) and a](b) and [y](https://a.test/)[^2]"), SITE);
    expect(html).toContain("[^1]: note");
    expect(html).toContain('<a href="https://a.test/">y</a><sup');
  });

  it("gives every heading its own address, whatever it says", () => {
    const html = renderBody(post({}, "## Sources\n\n## Côte d'Ivoire & *more*\n\n## Same\n\n### Same\n\n## !!!\n\n## ガス\n\n## カス\n\n## हिन्दी\n\n## See [x](https://a.test/)"), SITE);
    expect([...html.matchAll(/<h\d id="([^"]+)"/g)].map((m) => m[1])).toEqual(["sources-2", "cote-d-ivoire-more", "same", "same-2", "section", "ガス", "カス", "हिन्दी", "see-x"]);
    expect(html).toContain('<h2 id="same"><a class="self" href="#same">Same</a></h2>');
    expect(html).toContain('<h2 id="see-x">See <a href="https://a.test/">');
  });

  it("lists the contents of a long post only", () => {
    const html = renderPost(post(SOURCES, "## A\n\n### Not this\n\n## B `code`\n\n## C & D"), SITE);
    expect(html).toContain('<ul><li><a href="#a">A</a></li><li><a href="#b-code">B code</a></li><li><a href="#c-d">C &amp; D</a></li><li><a href="#sources">Sources</a></li></ul>');
    expect(renderPost(post(SOURCES, "## A\n\n## B"), SITE)).not.toContain('class="contents"');
  });

  it("opens an image at full size, unless it is already a link", () => {
    const html = renderBody(post({}, "![a](c.png)\n\n[![b](c.png)](https://a.test/)", ["c.png"]), SITE);
    expect(html).toContain('<a class="zoom" href="/reports/a-post/c.png"><img');
    expect(html.match(/class="zoom"/g)).toHaveLength(1);
  });

  it("gives link previews a full address and cover, and hides drafts and dev from search engines", () => {
    const p = post({ cover: "c.jpg", coverAlt: "A cover" }, "x", ["c.jpg"]);
    const html = renderPost(p, SITE);
    expect(html).toContain('<link rel="canonical" href="https://site.test/reports/a-post/" />');
    expect(html).toContain('content="https://site.test/reports/a-post/c.jpg"');
    expect(html).not.toContain("noindex");
    expect(renderPost(p, { ...SITE, noindex: true })).toContain("noindex");
    expect(renderPost(post({ draft: true }), SITE)).toContain("noindex");
    expect(renderPost(p, { ...SITE, url: "" })).not.toContain("canonical");
  });

  it("lists posts, and says so when there are none", () => {
    expect(renderIndex([post()], SITE)).toContain('<a href="/reports/a-post/">A title</a>');
    expect(renderIndex([], SITE)).toContain("Nothing has been published yet.");
    expect(renderSplashLinks([], SITE)).toBe("");
    expect(renderSplashLinks([1, 2, 3, 4].map((n) => post({}, "x", [], `p${n}`)), SITE).match(/<li>/g)).toHaveLength(3);
  });

  const numbers = (text: string) => renderPost(post(SOURCES, "```numbers\n" + text + "\n```"), SITE);

  it("ends a post with the newest others and the tools, under the site's base", () => {
    const posts = ["a", "b", "c", "d", "e"].map((s) => post({ title: `<${s}>` }, "x", [], s));
    const html = renderPost(posts[1], { ...SITE, base: "/sub/" }, posts);
    const next = /<ul class="next">(.*?)<\/ul>/.exec(html)![1];
    expect([...next.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual(["/sub/reports/a/", "/sub/reports/c/", "/sub/reports/d/"]);
    expect(next).toContain("&lt;a&gt;");
    expect(html).toContain('href="/sub/deployment/?skipIntro=1"');
    expect(html).toContain('href="https://futuregridsimulator.');
    expect(renderPost(posts[0], SITE, [posts[0]])).not.toContain('class="next"');
  });

  it("names the newest post at the top of the splash page, once there is one", () => {
    expect(renderSplashTop([], SITE)).toBe("");
    expect(renderSplashTop([post({ title: "A & B", kind: "blog" })], SITE)).toContain('<a href="/reports/a-post/"><b>Latest post</b> A &amp; B</a>');
  });

  it.each(["numbers foo", "Numbers", "chart line", "Chart"])("refuses a block marked %s, which would be shown as code", (info) => {
    expect(() => renderBody(post({}, "```" + info + "\nx\n```"), SITE)).toThrow("should start with just");
  });

  it("makes room for wide values, and measures table cells by what readers see", () => {
    expect(numbers("- value: 12.3 GW\n  label: a")).toContain('<dl class="numbers">');
    expect(numbers("- value: WWWWWWWW\n  label: a")).toContain('class="numbers roomy"');
    expect(renderBody(post({}, "| [a](https://a.test/a-long-address-to-a-page) |\n|---|\n| b |"), SITE)).not.toContain("wide");
  });

  it("gives columns of sentences more room than columns of numbers", () => {
    const html = renderBody(post({}, "| N | GW |\n|---|--:|\n| A sentence that is long enough | 1 |\n\n| A |\n|---|\n| b |"), SITE);
    expect(html.match(/class="wide"/g)).toHaveLength(2);
    expect(html).toMatch(/<th class="wide">N/);
  });

  it("sets key numbers as they are written, with citations in the labels", () => {
    const html = numbers("- value: 1.20\n  label: a <b>[^2]\n- value: 8.8%\n  label: c");
    expect(html).toContain('<dt>a &lt;b&gt;<sup class="cite">[<a id="cite_2"');
    expect(html).toContain("<dd>1.20</dd>");
    expect(html).toContain("<dd>8.8%</dd>");
  });

  it.each([
    ["no label", "- value: 1", '"label"'],
    ["a misspelt detail", "- value: 1\n  lable: x", '"lable"'],
    ["five numbers", "- {value: 1, label: x}\n".repeat(5), "one to four"],
    ["a citation in the value", "- value: 5[^1]\n  label: x", "in the label"],
    ["a sentence as a value", "- value: about a third of everything\n  label: x", "too long"],
    ["an unquoted colon", "- value: 1\n  label: a: b", "quotes"],
    ["text that is not a list", "hello", "one to four"],
  ])("refuses key numbers with %s", (_what, text, message) => {
    expect(() => numbers(text)).toThrow(message);
  });
});
