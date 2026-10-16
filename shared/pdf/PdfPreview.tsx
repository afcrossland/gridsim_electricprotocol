import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import "pdfjs-dist/web/pdf_viewer.css";

interface Props {
  blob: Blob;
  /** Names a page for assistive technology, e.g. "Page 3 of 12". */
  pageLabel: (n: number, total: number) => string;
}

/**
 * Shows the finished PDF page by page. The browser's own embedded PDF viewer cannot be used here: when a link is
 * clicked in it, Chrome navigates the whole tab away from the app. This viewer (pdf.js) draws each page, lays the
 * real text over it so it can be selected and read aloud, and turns every link in the PDF into an ordinary anchor that
 * opens in a new tab. The downloaded file is the same PDF, with its full accessibility tags.
 */
export default function PdfPreview({ blob, pageLabel }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = worker;

      const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
      destroy = () => void task.destroy();
      const doc = await task.promise;
      const el = host.current;
      if (!el || cancelled) return;
      el.replaceChildren();

      const dpr = window.devicePixelRatio || 1;
      for (let n = 1; n <= doc.numPages; n++) {
        if (cancelled) return;
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(1.6, Math.max(0.5, (el.clientWidth - 8) / base.width));
        const viewport = page.getViewport({ scale });

        const wrap = document.createElement("div");
        wrap.setAttribute("role", "group");
        wrap.setAttribute("aria-label", pageLabel(n, doc.numPages));
        wrap.style.cssText = `position:relative;width:${viewport.width}px;height:${viewport.height}px;margin:0 auto 12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);`;
        wrap.style.setProperty("--scale-factor", String(scale));
        wrap.style.setProperty("--total-scale-factor", String(scale));

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.cssText = `width:${viewport.width}px;height:${viewport.height}px;display:block;`;
        canvas.setAttribute("aria-hidden", "true");
        wrap.appendChild(canvas);
        el.appendChild(wrap);

        const context = canvas.getContext("2d");
        if (!context) continue;
        await page.render({
          canvasContext: context,
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        }).promise;

        // The real text, on top of the picture, so it can be selected, searched and read aloud.
        const textDiv = document.createElement("div");
        textDiv.className = "textLayer";
        wrap.appendChild(textDiv);
        await new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textDiv, viewport }).render();

        // Every link in the PDF becomes a normal anchor that opens in a new tab.
        for (const a of await page.getAnnotations()) {
          if (a.subtype !== "Link" || !a.url) continue;
          const [ax, ay, bx, by] = a.rect as number[];
          const [x1, y1] = viewport.convertToViewportPoint(ax, ay);
          const [x2, y2] = viewport.convertToViewportPoint(bx, by);
          const link = document.createElement("a");
          link.href = a.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.setAttribute("aria-label", a.url);
          link.style.cssText = `position:absolute;left:${Math.min(x1, x2)}px;top:${Math.min(y1, y2)}px;width:${Math.abs(x2 - x1)}px;height:${Math.abs(y2 - y1)}px;z-index:3;`;
          wrap.appendChild(link);
        }
      }
    })().catch((error) => console.error("The report preview could not be drawn", error));

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [blob, pageLabel]);

  return <Box ref={host} sx={{ flex: 1, minHeight: 320, overflow: "auto", bgcolor: "action.hover", p: 1 }} />;
}
