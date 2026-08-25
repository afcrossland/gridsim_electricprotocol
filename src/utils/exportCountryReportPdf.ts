import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// A4 at 96dpi - CSS pixel size of the report pages. Matches the sibling
// gridsim-frontend project's own report export exactly (src/utils/
// exportReportPdf.ts there) - same page geometry, same capture approach.
export const PAGE_W = 794;
export const PAGE_H = 1123;

// The print scale factor: 300dpi / 96dpi ~= 3.125. Captured at this scale so
// text and borders come out crisp in the PDF rather than upscaled from a
// 96dpi screenshot.
const PRINT_SCALE = 300 / 96;

/**
 * Walks every `.report-page` element under `rootId`, rasterises each at
 * print resolution, and assembles them into a single downloadable A4 PDF.
 * The root is expected to be mounted off-screen (see CountryReportDialog) -
 * this function only reads the DOM, it does not care where it sits.
 */
export async function generateCountryReportPdf(rootId: string, filename: string): Promise<void> {
  const root = document.getElementById(rootId);
  if (!root) throw new Error(`#${rootId} not found`);

  const pages = Array.from(root.querySelectorAll<HTMLElement>(".report-page"));
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      backgroundColor: "#ffffff",
      scale: PRINT_SCALE,
      useCORS: true,
      logging: false,
      width: PAGE_W,
      height: PAGE_H,
    });
    if (i > 0) pdf.addPage();
    // JPEG at 0.92 - flag images and fills compress losslessly-enough at this
    // quality while keeping the file a fraction of full PNG's size.
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
  }

  pdf.save(filename);
}

export function fmtReportDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function fmtTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}
