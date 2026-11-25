---
title: The title, as it should read on the page
kind: report
date: 2026-11-24
summary: One or two sentences, up to 280 characters. Shown on the list and when the page is shared.
authors: [First Author, Second Author]
draft: true
# Optional. Each file must be in this folder.
# cover: cover.jpg
# coverAlt: What the cover image shows (needed with a cover)
# pdf: the-report.pdf
sources:
  - label: Name of the source, with its year
    url: https://example.org/
---

Opening paragraph. Leave a blank line between paragraphs.

## A heading

Some **bold** and *italic* text, and [a link](https://example.org/). Cite a source by its number in the list above.[^1]

> A key point, set apart from the text.

- A bullet
- Another bullet

| Country | Solar (GW) |
| ------- | ---------: |
| Example |       12.3 |

An image from this folder, with a description for people who can't see it, then a caption:

`![Line chart: solar doubles by 2030](chart.png "Solar capacity, GW. Source: name, year")`

A chart, drawn by the reader's browser (see reports/README.md):

```chart
type: column
title: Placeholder chart
description: A grows and B stays level.
unit: GW
caption: "Placeholder numbers. Source: name, year.[^1]"
data: |
  Year, A, B
  2024, 4, 3
  2025, 6, 3
```
