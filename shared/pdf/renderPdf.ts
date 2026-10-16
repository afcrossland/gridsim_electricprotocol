import PDFDocument from "pdfkit";
import type { Block, ListItem, PdfAssets, ReportModel } from "./types";

/**
 * Writes a report as a PDF/UA-1 document with PDFKit - adapted from the TUC workplace calculator's report writer.
 * Every piece of content is tagged (headings, paragraphs, tables with header cells, lists, figures with alt text) and
 * everything that is only decoration (header band, rules, page numbers) is marked as an Artifact. Fonts are embedded,
 * as PDF/UA requires. Nothing is sent anywhere: this runs in the browser.
 */

type El = PDFKit.PDFStructureElement;
/** PDFKit's type definitions do not know the PDF/UA subset or the `scope` option, so these are widened here. */
type Doc = PDFKit.PDFDocument;

const MM = 72 / 25.4;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 16 * MM;
const BODY_W = PAGE_W - 2 * MARGIN;
const BAND_INNER = 22 * MM;
const BAND_COVER = 34 * MM;
const FOOT_H = 12 * MM;
const BODY_BOTTOM = PAGE_H - FOOT_H - 3 * MM;

const FONT = { head: "head", body: "body", bold: "bold" } as const;
const lineGap = (size: number) => size * 0.19;

/**
 * PDFKit writes each font's CIDSet from the glyphs it has drawn, but the subset also pulls in the parts of accented
 * and composite characters when encoded, so the list comes out short and PDF/UA fails (veraPDF 7.21.4.2). Encoding the
 * subset first, then listing every glyph in it, fixes that.
 */
function completeFontSubsets(doc: Doc): void {
  type FontLike = { subset?: { glyphs: number[]; encode(): unknown }; widths?: (number | undefined)[] };
  const families = (doc as unknown as { _fontFamilies: Record<string, FontLike> })._fontFamilies;
  for (const font of Object.values(families)) {
    if (!font.subset?.encode || !font.widths) continue;
    font.subset.encode();
    for (let gid = 0; gid < font.subset.glyphs.length; gid++) if (font.widths[gid] == null) font.widths[gid] = 0;
  }
}

export async function renderReportPdf(model: ReportModel, assets: PdfAssets): Promise<Uint8Array> {
  const { brand } = model;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    autoFirstPage: false,
    // No default font: the built-in PDF fonts cannot be embedded, and PDF/UA needs every font embedded.
    font: null,
    bufferPages: true,
    pdfVersion: "1.7",
    subset: "PDF/UA",
    tagged: true,
    displayTitle: true,
    lang: model.lang,
    info: { Title: model.documentTitle, Author: brand.author, Subject: model.title },
  } as unknown as ConstructorParameters<typeof PDFDocument>[0]) as Doc;

  const chunks: Uint8Array[] = [];
  doc.on("data", (c: Uint8Array) => chunks.push(c));
  const finished = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  doc.registerFont(FONT.head, assets.headFont as unknown as Buffer);
  doc.registerFont(FONT.body, assets.bodyFont as unknown as Buffer);
  doc.registerFont(FONT.bold, assets.boldFont as unknown as Buffer);

  type Child = El | (() => void);
  const struct = (type: string, options?: Record<string, unknown> | Child | Child[], children?: Child | Child[]): El =>
    (doc.struct as unknown as (...a: unknown[]) => El).call(doc, type, options, children);
  const root = struct("Document");
  doc.addStructure(root);

  let y = 0;

  /** Decoration: not part of the content a screen reader reads. */
  const artifact = (fn: () => void, options: Record<string, unknown> = { type: "Layout" }) => {
    doc.markContent("Artifact", options as Parameters<Doc["markContent"]>[1]);
    fn();
    doc.endMarkedContent();
  };

  const newPage = (cover: boolean) => {
    doc.addPage();
    const bandH = cover ? BAND_COVER : BAND_INNER;
    const logoH = (cover ? 16 : 10) * MM;
    const logoW = logoH * assets.logoAspect;
    const logoY = (bandH - logoH) / 2;
    artifact(() => {
      doc.rect(0, 0, PAGE_W, bandH).fill(brand.primary);
    });
    if (cover) {
      // The logo is the brand mark, so on the cover it is real content with a description.
      root.add(
        struct("Figure", { alt: model.logoAlt }, () => {
          doc.image(assets.logo as unknown as Buffer, MARGIN, logoY, { height: logoH });
        }),
      );
      artifact(() => {
        doc.font(FONT.head).fontSize(13).fillColor("#fff");
        doc.text(model.title, MARGIN + logoW + 6 * MM, bandH / 2 - 8, { lineBreak: false });
      });
    } else {
      artifact(() => {
        doc.image(assets.logo as unknown as Buffer, MARGIN, logoY, { height: logoH });
        doc.font(FONT.head).fontSize(10.5).fillColor("#fff");
        doc.text(model.title, MARGIN + logoW + 5 * MM, bandH / 2 - 6, { lineBreak: false });
      });
    }
    y = bandH + 9 * MM;
  };

  const ensure = (h: number, cover = false) => {
    if (y + h > BODY_BOTTOM) newPage(cover);
  };

  const measure = (text: string, font: string, size: number, width: number) => {
    doc.font(font).fontSize(size);
    return doc.heightOfString(text, { width, lineGap: lineGap(size) });
  };


  // ---- text with live links ----
  const URL_RE = /(https?:\/\/[^\s;,<>"')\]]+[^\s;,.<>"')\]])/g;

  /**
   * The children of a tagged text element: plain runs as marked content, and each web address as a `Link` structure
   * element holding a link annotation (PDF/UA needs the annotation inside the structure tree, with alt text). Runs
   * are drawn with `continued` so the paragraph wraps as one; a link that wraps gets one annotation per line.
   */
  const richChildren = (
    text: string,
    o: { font: string; size: number; color: string; x: number; y: number; width: number; align?: "left" | "right" },
  ): Child[] => {
    const parts = text
      .split(URL_RE)
      .map((p, i) => ({ p, link: i % 2 === 1 }))
      .filter((x) => x.p !== "");
    if (parts.length === 0) parts.push({ p: " ", link: false });
    return parts.map(({ p, link }, k) => {
      const last = k === parts.length - 1;
      const pos = k === 0 ? [o.x, o.y] : [];
      const opts = { width: o.width, lineGap: lineGap(o.size), align: o.align ?? "left", continued: !last };
      const draw = (extra: Record<string, unknown> = {}) => {
        doc.font(o.font).fontSize(o.size).fillColor(link ? brand.heading : o.color);
        (doc.text as unknown as (...a: unknown[]) => void).call(doc, p, ...pos, { ...opts, ...extra });
      };
      return link ? struct("Link", { alt: p }, () => draw({ link: p, underline: true })) : draw;
    });
  };

  /** Draws a paragraph-like piece of text tagged with `tag` and moves down. */
  const paragraph = (
    text: string,
    o: { font?: string; size?: number; color?: string; before?: number; after?: number; tag?: string },
  ) => {
    const font = o.font ?? FONT.body;
    const size = o.size ?? 10.5;
    const h = measure(text, font, size, BODY_W);
    y += o.before ?? 0;
    ensure(h);
    root.add(
      struct(
        o.tag ?? "P",
        richChildren(text, { font, size, color: o.color ?? brand.text, x: MARGIN, y, width: BODY_W }),
      ),
    );
    y += h + (o.after ?? 3 * MM);
  };

  // ---- title block (cover) ----
  const title = (b: Extract<Block, { type: "title" }>) => {
    paragraph(b.kicker, { size: 10.5, color: brand.heading, after: 1 * MM });
    paragraph(b.text, { font: FONT.head, size: 24, color: brand.primary, tag: "H1", after: 2 * MM });
    if (b.sub) paragraph(b.sub, { size: 10, color: brand.text, after: 4 * MM });
  };

  // ---- key figures: a row of tiles, each one reads as a single paragraph ("Label: value") ----
  const metrics = (b: Extract<Block, { type: "metrics" }>) => {
    const gap = 3 * MM;
    const w = (BODY_W - gap * (b.items.length - 1)) / b.items.length;
    const h = 20 * MM;
    ensure(h + 4 * MM);
    b.items.forEach((item, i) => {
      const x = MARGIN + i * (w + gap);
      artifact(() => {
        doc.roundedRect(x, y, w, h, 3).lineWidth(0.75).strokeColor(brand.line).stroke();
      });
      root.add(
        struct("P", () => {
          doc.font(FONT.bold).fontSize(8.5).fillColor(brand.text);
          doc.text(`${item.label}: `, x + 3 * MM, y + 3 * MM, { width: w - 6 * MM, continued: false, lineBreak: false });
          doc.font(FONT.head).fontSize(18).fillColor(brand.heading);
          doc.text(item.value, x + 3 * MM, y + 9.5 * MM, { width: w - 6 * MM, lineBreak: false });
        }),
      );
    });
    y += h + 4 * MM;
  };

  // ---- tables ----
  const table = (b: Extract<Block, { type: "table" }>) => {
    const size = 9.5;
    const padX = 2 * MM;
    const padY = 1.3 * MM;
    const cols = b.rows[0]?.length ?? b.head?.length ?? 1;
    const fractions = b.widths ?? (cols === 2 ? [0.38, 0.62] : Array(cols).fill(1 / cols));
    const widths = fractions.map((f) => f * BODY_W);
    const xs = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((a, v) => a + v, 0));
    const right = new Set(b.alignRight ?? []);
    const capH = b.caption ? measure(b.caption, FONT.head, 10.5, BODY_W) + 2 * MM : 0;
    const tbl = struct("Table");
    ensure(capH + 3 * (size * 1.5));
    root.add(tbl);
    if (b.caption) {
      const caption = b.caption;
      tbl.add(
        struct("Caption", () => {
          doc.font(FONT.head).fontSize(10.5).fillColor(brand.heading).text(caption, MARGIN, y, { width: BODY_W });
        }),
      );
    }
    y += capH;

    const drawRow = (cells: string[], head: boolean) => {
      const heights = cells.map((c, i) =>
        measure(c, head || i === 0 ? FONT.bold : FONT.body, size, widths[i] - 2 * padX),
      );
      const rowH = Math.max(...heights) + 2 * padY;
      ensure(rowH);
      const tr = struct("TR");
      tbl.add(tr);
      cells.forEach((c, i) => {
        const isHead = head || i === 0;
        tr.add(
          struct(
            isHead ? "TH" : "TD",
            isHead ? { scope: head ? "Column" : "Row" } : {},
            richChildren(c, {
              font: isHead ? FONT.bold : FONT.body,
              size,
              color: brand.text,
              x: xs[i] + padX,
              y: y + padY,
              width: widths[i] - 2 * padX,
              align: right.has(i) ? "right" : "left",
            }),
          ),
        );
      });
      artifact(() => {
        doc
          .moveTo(MARGIN, y + rowH)
          .lineTo(MARGIN + BODY_W, y + rowH)
          .lineWidth(0.75)
          .strokeColor(brand.line)
          .stroke();
      });
      y += rowH;
    };

    if (b.head) drawRow(b.head, true);
    for (const r of b.rows) drawRow(r, false);
    tbl.end();
    y += 3 * MM;
  };

  // ---- lists ----
  const list = (b: Extract<Block, { type: "list" }>) => {
    const size = 10;
    const indent = 5 * MM;
    const w = BODY_W - indent;
    const l = struct("L");
    // A line break inside an item starts a new line of its own: each line is laid out separately, because a run of
    // continued text (used for links) does not restart at the left margin after a "\n".
    const linesOf = (item: ListItem) => item.lines ?? item.text.split("\n").map((text) => ({ text, emphasis: false }));
    const leadHeight = (item: { lead?: string }) => (item.lead ? measure(item.lead, FONT.bold, size, w) + 0.6 * MM : 0);
    const lineHeight = (line: { text: string; emphasis?: boolean }) =>
      measure(line.text || " ", line.emphasis ? FONT.bold : FONT.body, size, w);
    const itemHeight = (item: ListItem) =>
      leadHeight(item) + linesOf(item).reduce((a, line) => a + lineHeight(line), 0);
    ensure(itemHeight(b.items[0]));
    root.add(l);
    for (const item of b.items) {
      const leadH = leadHeight(item);
      const h = itemHeight(item);
      ensure(h);
      const li = struct("LI");
      l.add(li);
      li.add(
        struct("Lbl", () => {
          doc.font(FONT.body).fontSize(size).fillColor(brand.text).text("•", MARGIN + 1.2 * MM, y, { lineBreak: false });
        }),
      );
      let lineY = y + leadH;
      const bodyChildren = linesOf(item).flatMap((line) => {
        const children = richChildren(line.text, {
          font: line.emphasis ? FONT.bold : FONT.body,
          size,
          color: line.emphasis ? brand.heading : brand.text,
          x: MARGIN + indent,
          y: lineY,
          width: w,
        });
        lineY += lineHeight(line);
        return children;
      });
      li.add(
        struct("LBody", [
          // The lead (e.g. the question) sits on its own line(s) in bold, with the detail beneath it.
          ...(item.lead
            ? [
                () => {
                  doc.font(FONT.bold).fontSize(size).fillColor(brand.text);
                  doc.text(item.lead as string, MARGIN + indent, y, { width: w, lineGap: lineGap(size) });
                },
              ]
            : []),
          ...bodyChildren,
        ]),
      );
      li.end();
      y += h + 2.2 * MM;
    }
    l.end();
    y += 2 * MM;
  };

  // ---- horizontal bar chart (vector, inside a Figure that carries the alt text) ----
  const bars = (b: Extract<Block, { type: "bars" }>) => {
    const twin = b.rows.some((r) => r.secondary);
    const barH = (twin ? 2.6 : 4.6) * MM;
    const minRowH = (twin ? 9.5 : 7) * MM;
    const labelW = 66 * MM;
    const valueW = twin ? 22 * MM : 14 * MM;
    const trackW = BODY_W - labelW - valueW - 4 * MM;
    const size = 9;
    // A long label wraps onto a second line, so each row is as tall as its own label needs.
    const heights = b.rows.map((r) => Math.max(minRowH, measure(r.label, FONT.body, size, labelW - 2 * MM) + 3 * MM));
    const chartH = heights.reduce((a, h) => a + h, 0);
    const legendH = b.legend ? 6 * MM : 0;
    // Keep the title with its chart: start a new page for both rather than leave the title alone at the bottom.
    ensure(measure(b.title, FONT.head, 10.5, BODY_W) + 2 * MM + legendH + chartH);
    paragraph(b.title, { font: FONT.head, size: 10.5, color: brand.heading, after: 1 * MM });
    if (b.legend) {
      const legend = b.legend;
      const first = b.rows[0];
      artifact(() => {
        let x = MARGIN;
        for (const [name, color] of [
          [legend.primary, first?.color ?? brand.primary],
          [legend.secondary, first?.secondary?.color ?? brand.line],
        ] as const) {
          doc.rect(x, y + 0.6 * MM, 3 * MM, 3 * MM).fill(color);
          doc.font(FONT.body).fontSize(8.5).fillColor(brand.text);
          doc.text(name, x + 4.2 * MM, y + 0.5 * MM, { lineBreak: false });
          x += 4.2 * MM + doc.widthOfString(name) + 7 * MM;
        }
      });
      y += legendH;
    }
    root.add(
      struct("Figure", { alt: b.alt }, () => {
        let top = y;
        b.rows.forEach((r, i) => {
          const rowH = heights[i];
          doc.font(FONT.body).fontSize(size).fillColor(brand.text);
          doc.text(r.label, MARGIN, top + 1.5 * MM, { width: labelW - 2 * MM, lineGap: lineGap(size) });
          const series = [r, ...(r.secondary ? [r.secondary] : [])];
          const groupH = series.length * barH + (series.length - 1) * 0.8 * MM;
          series.forEach((x, k) => {
            const barTop = top + (rowH - groupH) / 2 + k * (barH + 0.8 * MM);
            doc.rect(MARGIN + labelW, barTop, trackW, barH).fill("#EEF1F3");
            if (x.value !== null) doc.rect(MARGIN + labelW, barTop, Math.max(1, trackW * x.value), barH).fill(x.color);
            doc.font(k === 0 ? FONT.bold : FONT.body).fontSize(twin ? 8 : size).fillColor(brand.text);
            doc.text(x.display, MARGIN + labelW + trackW + 2 * MM, barTop + (twin ? -0.4 * MM : 0.5 * MM), {
              width: valueW,
              align: "right",
              lineBreak: false,
            });
          });
          top += rowH;
        });
      }),
    );
    y += chartH + 3 * MM;
  };

  // ---- the pages ----
  for (const page of model.pages) {
    newPage(!!page.cover);
    for (const b of page.blocks) {
      switch (b.type) {
        case "title":
          title(b);
          break;
        case "heading":
          paragraph(b.text, {
            font: FONT.head,
            size: 12.5,
            color: brand.heading,
            before: 5 * MM,
            after: 1.5 * MM,
            tag: "H2",
          });
          break;
        case "para":
          if (b.style === "lead") paragraph(b.text, { size: 12.5, before: 2 * MM });
          else if (b.style === "small") paragraph(b.text, { size: 9 });
          else paragraph(b.text, {});
          break;
        case "metrics":
          metrics(b);
          break;
        case "table":
          table(b);
          break;
        case "list":
          list(b);
          break;
        case "bars":
          bars(b);
          break;
      }
    }
  }

  // Page footers need the final page count, so they are drawn last (as pagination artifacts).
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    artifact(
      () => {
        doc
          .moveTo(MARGIN, PAGE_H - FOOT_H)
          .lineTo(PAGE_W - MARGIN, PAGE_H - FOOT_H)
          .lineWidth(0.75)
          .stroke(brand.line);
        doc.font(FONT.body).fontSize(8.5).fillColor(brand.text);
        doc.text(model.footer, MARGIN, PAGE_H - FOOT_H + 3 * MM, { lineBreak: false });
        doc.text(model.pageOf(i + 1, range.count), MARGIN, PAGE_H - FOOT_H + 3 * MM, {
          width: BODY_W,
          align: "right",
          lineBreak: false,
        });
      },
      { type: "Pagination", subtype: "Footer" },
    );
  }

  completeFontSubsets(doc);
  root.end();
  doc.end();
  await finished;
  const size = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
