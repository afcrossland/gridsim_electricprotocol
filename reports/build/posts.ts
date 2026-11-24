import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * A report or blog post: one folder in reports/content, holding index.md and the images and PDF it
 * uses. The folder's name is the end of its address (/reports/<name>/). See reports/README.md.
 */
export interface Post {
  slug: string;
  dir: string;
  title: string;
  kind: "report" | "blog";
  date: string;
  summary: string;
  authors: string[];
  cover?: string;
  coverAlt: string;
  pdf?: string;
  sources: { label: string; url?: string }[];
  draft: boolean;
  markdown: string;
  /** Everything in the folder that goes on the site, besides the page itself. */
  files: string[];
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEYS = ["title", "kind", "date", "summary", "authors", "cover", "coverAlt", "pdf", "sources", "draft"];
/** The only files that are published. Anything else in a post's folder fails the build: the folder is public. */
const PUBLISHED = /\.(png|jpe?g|webp|svg|pdf|csv|xlsx)$/i;

export function parsePost(slug: string, dir: string, text: string, files: string[]): Post {
  const problems: string[] = [];
  const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/.exec(text);
  if (!match) throw new Error(`reports/content/${slug}: index.md must start with a --- block of details`);

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch (error) {
    throw new Error(`reports/content/${slug}: the details block is not valid YAML: ${(error as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`reports/content/${slug}: the details block must be a list of "name: value" lines`);
  }
  const meta = parsed as Record<string, unknown>;

  if (!SLUG.test(slug)) problems.push("the folder name may only use lower-case letters, numbers and single hyphens");
  for (const key of Object.keys(meta)) if (!KEYS.includes(key)) problems.push(`unknown detail "${key}"`);

  const text_ = (key: string, required: boolean): string => {
    const raw = meta[key];
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value === undefined || value === null || value === "") {
      if (required) problems.push(`"${key}" is missing`);
      return "";
    }
    if (typeof value !== "string") {
      problems.push(`"${key}" must be text (put it in quotes)`);
      return "";
    }
    return value;
  };
  const file = (key: string, allowed: RegExp, what: string): string | undefined => {
    const name = text_(key, false);
    if (!name) return undefined;
    if (!allowed.test(name)) problems.push(`"${key}" must be ${what}`);
    else if (!files.includes(name)) problems.push(`"${key}" names ${name}, which is not in the folder`);
    return name;
  };

  const kind = text_("kind", true);
  if (kind && kind !== "report" && kind !== "blog") problems.push('"kind" must be report or blog');
  const date = text_("date", true);
  if (date && !isDate(date)) problems.push('"date" must be a real date written YYYY-MM-DD');
  const summary = text_("summary", true);
  if (summary.length > 280) problems.push('"summary" must be 280 characters or fewer');
  // Not `??`: a "draft:" left blank is null, and must fail rather than publish.
  const draft = "draft" in meta ? meta.draft : false;
  if (typeof draft !== "boolean") problems.push('"draft" must be true or false');
  const authors = meta.authors ?? [];
  if (!Array.isArray(authors) || authors.some((a) => typeof a !== "string")) problems.push('"authors" must be a list of names');
  const sources = meta.sources ?? [];
  if (
    !Array.isArray(sources) ||
    sources.some((s) => !s || typeof s.label !== "string" || (s.url !== undefined && (typeof s.url !== "string" || !/^https?:\/\//.test(s.url))))
  ) {
    problems.push('each of "sources" needs a label, and any url must start with http:// or https://');
  }
  for (const name of files) if (!PUBLISHED.test(name)) problems.push(`${name} is not a kind of file that can be published`);

  const post: Post = {
    slug,
    dir,
    title: text_("title", true),
    kind: kind as Post["kind"],
    date,
    summary,
    authors: authors as string[],
    cover: file("cover", /\.(png|jpe?g|webp)$/i, "a PNG, JPEG or WebP image"),
    coverAlt: text_("coverAlt", false),
    pdf: file("pdf", /\.pdf$/i, "a PDF"),
    sources: sources as Post["sources"],
    draft: draft as boolean,
    markdown: match[2] ?? "",
    files,
  };
  if (post.cover && !post.coverAlt) problems.push('"coverAlt" must describe the cover image');
  if (problems.length) throw new Error(`reports/content/${slug}:\n  - ${problems.join("\n  - ")}`);
  return post;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(time.getTime()) && time.toISOString().startsWith(value);
}

/** Newest first. Drafts and folders starting with "_" are left out, drafts only when not asked for. */
export function loadPosts(contentDir: string, { drafts = false } = {}): Post[] {
  if (!existsSync(contentDir)) return [];
  const posts: Post[] = [];
  for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const post = readPost(contentDir, entry.name);
    if (drafts || !post.draft) posts.push(post);
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export function readPost(contentDir: string, folder: string): Post {
  const dir = path.join(contentDir, folder);
  const names = readdirSync(dir).filter((name) => !name.startsWith("."));
  if (!names.includes("index.md")) throw new Error(`reports/content/${folder}: there is no index.md`);
  const files = names.filter((name) => name !== "index.md");
  return parsePost(folder.replace(/^_/, ""), dir, readFileSync(path.join(dir, "index.md"), "utf8"), files);
}
