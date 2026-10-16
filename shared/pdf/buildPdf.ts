import type { PdfAssets, ReportModel } from "./types";

/** The report as a PDF file. PDFKit is loaded only now, so it is not part of the first page load. */
export async function buildPdfBlob(model: ReportModel, assets: PdfAssets): Promise<Blob> {
  const { renderReportPdf } = await import("./renderPdf");
  const bytes = await renderReportPdf(model, assets);
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
