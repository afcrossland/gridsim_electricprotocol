/**
 * What a report contains, with no layout: pages of blocks. The writer (renderPdf.ts) draws these as a tagged,
 * accessible PDF/UA document. Each app builds its own model; wording and numbers live there so they can be tested
 * and translated in one place. Shared by Policy, Deployment and Homes (ported from the TUC calculator's report).
 */
export type Block =
  | { type: "title"; kicker: string; text: string; sub?: string }
  | { type: "heading"; text: string }
  | { type: "para"; text: string; style?: "lead" | "small" }
  | { type: "metrics"; items: { label: string; value: string }[] }
  | {
      type: "table";
      /** Omit for a table the surrounding heading already names. */
      caption?: string;
      head?: string[];
      rows: string[][];
      /** Column width fractions (sum to 1). */
      widths?: number[];
      /** Right-align these column indexes (numbers). */
      alignRight?: number[];
    }
  | { type: "list"; items: ListItem[] }
  | {
      type: "bars";
      title: string;
      /** One horizontal bar per row; `value` is 0..1, or null for "no data". */
      rows: {
        label: string;
        value: number | null;
        display: string;
        color: string;
        /** An optional second, thinner bar for the same row (for example questions answered next to score). */
        secondary?: { value: number | null; display: string; color: string };
      }[];
      /** Names the two series when rows carry a secondary bar. */
      legend?: { primary: string; secondary: string };
      alt: string;
    };

/** One bullet. `lead` is the bold first line; the detail is `text` (lines split on "\n") or explicit `lines`. */
export interface ListItem {
  lead?: string;
  text: string;
  /** Overrides `text`: each line can be emphasised (bold, in the brand colour), e.g. a score. */
  lines?: { text: string; emphasis?: boolean }[];
}

export interface ReportPage {
  cover?: boolean;
  blocks: Block[];
}

export interface ReportBrand {
  /** Header band and accents. */
  primary: string;
  heading: string;
  text: string;
  line: string;
  /** Written into the PDF's author field. */
  author: string;
}

export interface ReportModel {
  title: string;
  documentTitle: string;
  lang: string;
  pages: ReportPage[];
  /** Left side of every footer. */
  footer: string;
  /** "Page {n} of {total}". */
  pageOf: (n: number, total: number) => string;
  logoAlt: string;
  brand: ReportBrand;
}

export interface PdfAssets {
  headFont: Uint8Array;
  bodyFont: Uint8Array;
  boldFont: Uint8Array;
  /** PNG logo shown in the header band. */
  logo: Uint8Array;
  logoAspect: number;
}
