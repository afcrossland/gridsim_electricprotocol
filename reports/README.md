# Reports and blog (`/reports/`)

Every report or blog post is a folder in `reports/content/`. The build turns each one into a plain HTML page at
`/reports/<folder name>/`, lists them newest first at `/reports/`, and links the newest three from the splash page, with
the newest at its top too (it shows nothing until something is published). Every post ends with links to the newest others.
There is no CMS and no database.

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

## Charts

Describe a chart in a `chart` block and the reader's browser draws it, to fit their screen, with the values on hover, touch
or the arrow keys, and a table of the numbers underneath:

````
```chart
type: line
title: Solar capacity
description: Rooftop solar overtakes large solar in 2025.
unit: GW
caption: "Source: name, year.[^1]"
data: |
  Year, Rooftop, Large
  2023, 10, 14
  2024, 14, 16
  2025, 21, 18
```
````

- `type` is `line`, `column` or `bar` (sideways: best for long names). Columns and bars can have `stacked: true`.
- `data` is the numbers, as above, or the name of a CSV in the post's folder (`data: capacity.csv`), which readers can then
  download. The first column is the labels; up to four more are the numbers. A blank is a gap.
- `title`, `description` (for people who can't see the chart), `type` and `data` are needed. Text with a colon, or
  starting with a symbol such as `%`, needs quotes. Up to 60 columns fit; use a line or bars for more.
- Axes always start at zero. For any other kind of chart, use an image.

## Key numbers

One to four headline figures, set large. Labels can cite sources; values are up to 14 characters.

````
```numbers
- value: 8.8%
  label: of the world's electricity came from solar[^1]
- value: 2.4 TW
  label: installed
```
````

## How it works

- `build/posts.ts` reads and checks the folders, `build/render.ts` makes the pages, `build/page.css` is their style, and
  `build/plugin.ts` adds them to the Vite build and the dev server.
- HTML in a post's Markdown is shown as text, not run. The only script is
  `build/chart.client.js`, on pages that have a chart; `build/chart.ts` reads and checks the chart blocks.
- `VITE_SITE_URL` (set in `deploy.yml`) gives link previews a full address; `VITE_SITE_NOINDEX` keeps the dev copy out of
  search engines. If the site gets its own domain, change `VITE_SITE_URL`.
