# Reports and blog (`/reports/`)

Every report or blog post is a folder in `reports/content/`. The build turns each one into a plain HTML page at
`/reports/<folder name>/`, lists them newest first at `/reports/`, and links the newest three from the splash page (which
shows nothing until something is published). There is no CMS and no database.

## Add one

1. Copy `content/_example` to a new folder. Its name becomes the address, so use lower-case letters, numbers and hyphens
   (`content/india-rooftop-2026`), and don't rename it once published.
2. Edit `index.md`: the details between the `---` lines, then the text in Markdown. Start headings at `##`.
3. Put its images and PDF in the same folder. Only png, jpg, webp, svg, pdf, csv and xlsx files are allowed.
   Images need a description, and can have a caption: `![What it shows](chart.png "Caption. Source: name, year")`.
   Click an image on the page to open the full-size file.
   Cite a source by its number in the `sources` list: `[^1]`, or `[^1, 3]` for two. Captions can cite too, headings can't.
   Adding a source in the middle of the list changes the numbers after it, so add new ones at the end.
   A post with three or more `##` headings gets a list of contents, and every heading has its own address to share.
4. Run `npm run dev` and open `/reports/`. Drafts show there.
5. Delete `draft: true`, then open a PR into `Development`. Merging puts it on the dev site; a release to `main` publishes it.

Mistakes (a missing detail, an image that isn't there or has no description) fail the build with a message that names them.

**This repository is public.** `draft: true` keeps a post off the site, but anything pushed can be read on GitHub. Keep
unreleased or embargoed work, and its images, off GitHub until it can be public.

`date` is only shown and used for ordering; a post is live as soon as it is released, whatever its date. Folders starting
with `_` are ignored.

## How it works

- `build/posts.ts` reads and checks the folders, `build/render.ts` makes the pages, `build/page.css` is their style, and
  `build/plugin.ts` adds them to the Vite build and the dev server.
- HTML in a post's Markdown is shown as text, not run. The pages have no script.
- `VITE_SITE_URL` (set in `deploy.yml`) gives link previews a full address; `VITE_SITE_NOINDEX` keeps the dev copy out of
  search engines. If the site gets its own domain, change `VITE_SITE_URL`.
