import bodyUrl from "../assets/fonts/Eastman-Grotesque-Regular.woff?url";
import boldUrl from "../assets/fonts/Eastman-Grotesque-Demi-Bold.woff?url";
import headUrl from "../assets/fonts/Eastman-Grotesque-Bold.woff?url";
import type { PdfAssets } from "./types";

/**
 * The fonts and logo a report PDF embeds, fetched when a report is made so they are not part of the first page load.
 * Reports use the Global Solar Council's own Eastman Grotesque (the same family the apps use on screen): Bold for
 * headings, Demi-Bold for emphasis, Regular for body text. If a different brand supplies embeddable font files, drop
 * them into `shared/pdf/fonts/brand/` (e.g. Rockwell-Bold.ttf, Avenir-Regular.ttf, Avenir-Bold.ttf) and they take
 * precedence.
 */
const brandFonts = import.meta.glob("./fonts/brand/*.{ttf,otf}", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

const brandUrl = (pattern: RegExp): string | undefined =>
  Object.entries(brandFonts).find(([path]) => pattern.test(path.split("/").pop() ?? ""))?.[1];

const bytes = async (url: string): Promise<Uint8Array> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return new Uint8Array(await res.arrayBuffer());
};

/** `logoUrl` is a PNG (PDFKit cannot embed SVG); `logoAspect` is its width / height. */
export async function loadPdfAssets(logoUrl: string, logoAspect: number): Promise<PdfAssets> {
  const [headFont, bodyFont, boldFont, logo] = await Promise.all([
    bytes(brandUrl(/rockwell.*bold/i) ?? headUrl),
    bytes(brandUrl(/avenir.*(regular|book|roman)/i) ?? bodyUrl),
    bytes(brandUrl(/avenir.*(bold|heavy)/i) ?? boldUrl),
    bytes(logoUrl),
  ]);
  return { headFont, bodyFont, boldFont, logo, logoAspect };
}
