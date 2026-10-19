import PDFDocument from "pdfkit";
import { fmtInt, niceScale } from "./scale";
import type { Block, ChartSeries, ListItem, PdfAssets, ReportModel } from "./types";

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
    const startY = y;
    if (b.flag) {
      const flag = b.flag;
      // Drawn at the right edge, level with the title, as a Figure so it carries a description.
      const dims = (doc as unknown as { openImage(src: Uint8Array): { width: number; height: number } }).openImage(flag.data);
      const h = 11 * MM;
      const w = (h * dims.width) / dims.height;
      ensure(h);
      root.add(
        struct("Figure", { alt: flag.alt }, () => {
          doc.image(flag.data as unknown as Buffer, PAGE_W - MARGIN - w, startY + 4 * MM, { width: w, height: h });
        }),
      );
      artifact(() => {
        doc.rect(PAGE_W - MARGIN - w, startY + 4 * MM, w, h).lineWidth(0.5).stroke(brand.line);
      });
    }
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
      if (item.suns !== undefined) {
        // A row of five suns (a disc with rays) - solid for each sun earned, outlined for the rest. Decoration: the score
        // is also in the tile's text and the sentence above, so it is not part of what a screen reader reads.
        const suns = item.suns;
        artifact(() => {
          const r = 1.3 * MM; // the disc
          const outer = 2.4 * MM; // the tips of the rays
          const gap = 1.6 * MM;
          const total = 5 * 2 * outer + 4 * gap;
          for (let k = 0; k < 5; k++) {
            const cx = x + w - 3 * MM - total + outer + k * (2 * outer + gap);
            const cy = y + 13 * MM;
            doc.save();
            doc.lineWidth(0.8).lineCap("round").strokeOpacity(k < suns ? 1 : 0.5).strokeColor(brand.heading);
            for (let a = 0; a < 8; a++) {
              const ang = (a * Math.PI) / 4;
              doc.moveTo(cx + Math.cos(ang) * (r + 0.7 * MM), cy + Math.sin(ang) * (r + 0.7 * MM));
              doc.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
            }
            doc.stroke();
            doc.restore();
            doc.circle(cx, cy, r);
            if (k < suns) doc.fillAndStroke(brand.heading, brand.heading);
            else doc.lineWidth(0.8).stroke(brand.heading);
          }
        });
      }
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

  // ---- charts (vector, inside a Figure that carries the alt text) ----
  const MUTED = "#6B7280";
  const EDGE = "#3B3838";

  const texture = (x: number, top: number, w: number, h: number, kind: "hatch" | "dots") => {
    doc.strokeColor(EDGE).fillColor(EDGE);
    if (kind === "hatch") {
      doc.lineWidth(0.9);
      for (let k = -h; k < w; k += 5) doc.moveTo(x + k, top + h).lineTo(x + k + h, top);
      doc.stroke();
    } else {
      for (let gx = 3; gx < w; gx += 6) for (let gy = 3; gy < h; gy += 6) doc.circle(x + gx, top + gy, 1.4).fill();
    }
  };

  /** Fills a shape with a series colour (plus its texture, if any) and a thin outline. */
  const paintShape = (
    trace: () => void,
    color: string,
    box: { x: number; y: number; w: number; h: number },
    pattern?: "hatch" | "dots",
    light = false,
  ) => {
    doc.save();
    trace();
    if (light) doc.fillOpacity(0.55);
    doc.fill(color);
    doc.restore();
    if (pattern) {
      doc.save();
      trace();
      doc.clip();
      texture(box.x, box.y, box.w, box.h, pattern);
      doc.restore();
    }
    doc.save();
    trace();
    doc.lineWidth(0.5).stroke(EDGE);
    doc.restore();
  };

  const axisText = (text: string, x: number, top: number, align: "left" | "right" | "center", w = 60) => {
    doc.font(FONT.body).fontSize(8.5).fillColor(brand.text);
    const bx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    doc.text(text, bx, top, { width: w, align, lineBreak: false });
  };

  const chartLegend = (items: { name: string; color: string; pattern?: "hatch" | "dots"; dashed?: boolean }[], top: number) => {
    let x = MARGIN;
    for (const it of items) {
      if (it.dashed !== undefined) {
        doc.moveTo(x, top + 5).lineTo(x + 12, top + 5).lineWidth(1.6).strokeColor(it.color);
        if (it.dashed) doc.dash(3, { space: 2 });
        doc.stroke().undash();
        x += 16;
      } else {
        paintShape(() => doc.rect(x, top + 1, 9, 9), it.color, { x, y: top + 1, w: 9, h: 9 }, it.pattern);
        x += 13;
      }
      doc.font(FONT.body).fontSize(8.5).fillColor(brand.text).text(it.name, x, top + 1, { lineBreak: false });
      x += doc.widthOfString(it.name) + 14;
    }
  };

  const chartTitle = (title: string, top: number) => {
    doc.font(FONT.bold).fontSize(10).fillColor(brand.heading).text(title, MARGIN, top, { lineBreak: false });
  };

  /** Whole numbers when the ticks are 1 or more apart, otherwise as many decimals as the gap needs. */
  const fmtTick = (v: number, step: number) =>
    step >= 1 ? fmtInt(v) : v.toFixed(step < 0.1 ? 2 : 1).replace(/\.0+$/, "");

  const yGrid = (x0: number, w: number, values: number[], yOf: (v: number) => number) => {
    const step = values.length > 1 ? Math.abs(values[1] - values[0]) : 1;
    for (const v of values) {
      doc.moveTo(x0, yOf(v)).lineTo(x0 + w, yOf(v)).lineWidth(0.5).stroke(brand.line);
      axisText(fmtTick(v, step), x0 - 5, yOf(v) - 5, "right");
    }
  };

  /** Black or white, whichever reads better on this fill. */
  const textOn = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? "#3B3838" : "#fff";
  };

  const columns = (b: Extract<Block, { type: "columns" }>) => {
    const H = 165;
    const L = 46;
    const R = 6;
    const T = 14;
    const Bm = 18;
    const total = 14 + H + 18;
    ensure(total + 4 * MM);
    const top = y;
    root.add(
      struct("Figure", { alt: b.alt }, () => {
        chartTitle(b.title, top);
        const cy = top + 14;
        const x0 = MARGIN + L;
        const w = BODY_W - L - R;
        const maxV = Math.max(1, ...b.series.flatMap((s) => s.values));
        const scale = niceScale(maxV * 1.02, 4);
        const yOf = (v: number) => cy + T + (1 - v / scale.max) * (H - T - Bm);
        axisText(b.unit, x0 - 5, cy, "right");
        yGrid(x0, w, scale.values, yOf);
        const slot = w / b.labels.length;
        b.labels.forEach((label, m) => {
          const bw = (slot * 0.8) / b.series.length;
          b.series.forEach((s, k) => {
            const bx = x0 + m * slot + slot * 0.1 + k * bw;
            const by = yOf(s.values[m]);
            paintShape(() => doc.rect(bx, by, bw, yOf(0) - by), s.color, { x: bx, y: by, w: bw, h: yOf(0) - by }, s.pattern);
          });
          axisText(slot < 30 ? label[0] : label, x0 + m * slot + slot / 2, cy + H - Bm + 4, "center", slot);
        });
        doc.moveTo(x0, yOf(0)).lineTo(x0 + w, yOf(0)).lineWidth(0.8).stroke(MUTED);
        chartLegend(b.series, cy + H + 2);
      }),
    );
    y += total + 3 * MM;
  };

  const bands = (b: Extract<Block, { type: "bands" }>) => {
    const H = 165;
    const L = 46;
    const R = 6;
    const T = 6;
    const Bm = 20;
    const total = 14 + H + 18;
    ensure(total + 4 * MM);
    const top = y;
    const n = b.up[0].values.length;
    root.add(
      struct("Figure", { alt: b.alt }, () => {
        chartTitle(b.title, top);
        const cy = top + 14;
        const x0 = MARGIN + L;
        const w = BODY_W - L - R;
        const stack = (list: ChartSeries[]) => {
          const tops: number[][] = [];
          let acc = Array(n).fill(0) as number[];
          for (const s of list) {
            acc = acc.map((v, i) => v + s.values[i]);
            tops.push(acc);
          }
          return tops;
        };
        const upTops = stack(b.up);
        const downTops = stack(b.down ?? []);
        const upPeak = Math.max(0.01, ...(upTops.at(-1) ?? [0]));
        const downPeak = Math.max(0, ...(downTops.at(-1) ?? [0]));
        // One evenly spaced scale across both halves, so tick labels never crowd each other.
        const scale = niceScale(upPeak * 1.05, 5, -downPeak * 1.05);
        const xOf = (i: number) => x0 + (i / Math.max(1, n - 1)) * w;
        const yOf = (v: number) => cy + T + ((scale.max - v) / (scale.max - scale.min)) * (H - T - Bm);
        axisText(b.unit, x0 - 5, cy - 2, "right");
        yGrid(x0, w, scale.values, yOf);
        for (const tk of b.ticks) axisText(tk.label, xOf(tk.index), cy + H - Bm + 6, "center", 50);
        const box = { x: x0, y: cy + T, w, h: H - T - Bm };
        const band = (hi: number[], lo: number[], sign: 1 | -1) => () => {
          doc.moveTo(xOf(0), yOf(sign * hi[0]));
          for (let i = 1; i < n; i++) doc.lineTo(xOf(i), yOf(sign * hi[i]));
          for (let i = n - 1; i >= 0; i--) doc.lineTo(xOf(i), yOf(sign * lo[i]));
          doc.closePath();
        };
        const zero = Array(n).fill(0) as number[];
        b.up.forEach((s, k) => paintShape(band(upTops[k], k === 0 ? zero : upTops[k - 1], 1), s.color, box, s.pattern));
        (b.down ?? []).forEach((s, k) =>
          paintShape(band(downTops[k], k === 0 ? zero : downTops[k - 1], -1), s.color, box, s.pattern),
        );
        doc.moveTo(x0, yOf(0)).lineTo(x0 + w, yOf(0)).lineWidth(0.8).stroke(MUTED);
        chartLegend([...b.up, ...(b.down ?? [])], cy + H + 2);
      }),
    );
    y += total + 3 * MM;
  };

  const lines = (b: Extract<Block, { type: "lines" }>) => {
    const H = 165;
    const L = 52;
    const R = 8;
    const T = 8;
    const Bm = 20;
    const total = 14 + H + 18;
    ensure(total + 4 * MM);
    const top = y;
    const n = b.series[0].values.length;
    root.add(
      struct("Figure", { alt: b.alt }, () => {
        chartTitle(b.title, top);
        const cy = top + 14;
        const x0 = MARGIN + L;
        const w = BODY_W - L - R;
        const all = b.series.flatMap((s) => s.values);
        const scale = niceScale(Math.max(1, ...all) * 1.05, 4, Math.min(0, ...all) * 1.05);
        const xOf = (i: number) => x0 + (i / Math.max(1, n - 1)) * w;
        const yOf = (v: number) => cy + T + ((scale.max - v) / (scale.max - scale.min)) * (H - T - Bm);
        axisText(b.unit, x0 - 5, cy - 2, "right", 70);
        yGrid(x0, w, scale.values, yOf);
        for (const tk of b.ticks) axisText(tk.label, xOf(tk.index), cy + H - Bm + 6, "center", 40);
        if (scale.min < 0) doc.moveTo(x0, yOf(0)).lineTo(x0 + w, yOf(0)).lineWidth(0.9).stroke(MUTED);
        for (const s of b.series) {
          doc.save();
          doc.moveTo(xOf(0), yOf(s.values[0]));
          for (let i = 1; i < n; i++) doc.lineTo(xOf(i), yOf(s.values[i]));
          doc.lineWidth(1.6).strokeColor(s.color);
          if (s.dashed) doc.dash(4, { space: 3 });
          doc.stroke();
          doc.undash();
          doc.restore();
        }
        chartLegend(b.series.map((s) => ({ name: s.name, color: s.color, dashed: !!s.dashed })), cy + H + 2);
      }),
    );
    y += total + 3 * MM;
  };

  const split = (b: Extract<Block, { type: "split" }>) => {
    const rowH = 21 * MM;
    const total = 14 + b.rows.length * rowH;
    ensure(total + 4 * MM);
    const top = y;
    root.add(
      struct("Figure", { alt: b.alt }, () => {
        chartTitle(b.title, top);
        const x0 = MARGIN;
        const w = BODY_W;
        b.rows.forEach((r, i) => {
          const ry = top + 16 + i * rowH;
          doc.font(FONT.bold).fontSize(9).fillColor(brand.text).text(r.label, x0, ry, { lineBreak: false });
          const sum = r.parts.reduce((a, p) => a + p.value, 0) || 1;
          let x = x0;
          const bh = 7 * MM;
          const barTop = ry + 4 * MM;
          for (const p of r.parts) {
            const pw = (p.value / sum) * w;
            if (pw <= 0.5) continue;
            paintShape(() => doc.rect(x, barTop, pw, bh), p.color, { x, y: barTop, w: pw, h: bh }, p.pattern);
            if (pw > 70) {
              doc.font(FONT.bold).fontSize(8.5).fillColor(textOn(p.color));
              doc.text(`${p.display ?? fmtInt(p.value)} ${b.unit}`, x + 3, barTop + bh / 2 - 5, { width: pw - 6, lineBreak: false });
            }
            x += pw;
          }
          // Each bar has its own legend, directly beneath it, naming only the parts of that bar.
          chartLegend(r.parts, barTop + bh + 2 * MM);
        });
      }),
    );
    y += total + 3 * MM;
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
        case "columns":
          columns(b);
          break;
        case "bands":
          bands(b);
          break;
        case "lines":
          lines(b);
          break;
        case "split":
          split(b);
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
