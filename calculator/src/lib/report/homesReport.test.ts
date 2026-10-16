// @vitest-environment node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { renderReportPdf } from "../../../../shared/pdf/renderPdf";
import type { PdfAssets } from "../../../../shared/pdf/types";
import { calculateSavings } from "../calculate";
import type { Location, SavingsInputs } from "../types";
import { buildHomesReportModel } from "./homesReportModel";
import { formatMoney, outcomeRange, paybackText, rangeQty, rangeText, roundMoney, roundPct, sig2 } from "./ranges";

// The first calculation loads the ~10 MB irradiance dataset, which can exceed vitest's default 5 s when the whole
// suite runs in parallel - so a slow machine or CI runner does not fail the deploy.
vi.setConfig({ testTimeout: 20_000 });

const file = (rel: string) => new Uint8Array(readFileSync(new URL(rel, import.meta.url)));
const assets: PdfAssets = {
  headFont: file("../../../../shared/assets/fonts/Eastman-Grotesque-Bold.woff"),
  bodyFont: file("../../../../shared/assets/fonts/Eastman-Grotesque-Regular.woff"),
  boldFont: file("../../../../shared/assets/fonts/Eastman-Grotesque-Demi-Bold.woff"),
  logo: file("../../../../public/favicon.png"),
  logoAspect: 1,
};

const birmingham: Location = { lat: 52.48, lon: -1.9, displayName: "Birmingham, West Midlands, England, United Kingdom", countryCode: "gb" };
const sydney: Location = { lat: -33.87, lon: 151.2, displayName: "Sydney, New South Wales, Australia", countryCode: "au" };

const inputs = (location: Location): SavingsInputs => ({
  location,
  arrays: [{ panels: 10, panelWatts: 500, tilt: 35, azimuth: 0 }],
  batteryKWh: 10,
  demand: { band: "medium", annualKWh: 4000 },
  evCharging: false,
  tariffs: { importRateDay: 0.2, importRateNight: 0.07, exportRate: 0.07, inflationRate: 1.03 },
});

async function build(location: Location, name: string, flag: Uint8Array | null = null) {
  const i = inputs(location);
  const results = await calculateSavings(i);
  const model = buildHomesReportModel({ ...i, results, generatedOn: "1 January 2026", flag });
  const pdf = await renderReportPdf(model, assets);
  mkdirSync("test-output/reports", { recursive: true });
  writeFileSync(`test-output/reports/homes-${name}.pdf`, pdf);
  return { model, pdf, results };
}

const text = (pdf: Uint8Array) => Buffer.from(pdf).toString("latin1");

describe("rounding and ranges", () => {
  it("rounds to two significant figures, to the nearest 10 for small sums, and to the nearest 5 for percentages", () => {
    expect(sig2(718)).toBe(720);
    expect(sig2(5699)).toBe(5700);
    expect(sig2(71_800_000)).toBe(72_000_000);
    expect(roundMoney(718)).toBe(720);
    expect(roundMoney(-7)).toBe(-10);
    expect(roundMoney(-4)).toBe(0);
    expect(roundMoney(4238)).toBe(4200);
    expect(roundPct(77)).toBe(75);
    expect(roundPct(79)).toBe(80);
    expect(formatMoney("£", 7_180_000)).toBe("£7.2m");
    // No floating-point noise in the printed figure (this used to print £9.200000000000001m).
    expect(formatMoney("£", 9_200_000)).toBe("£9.2m");
    expect(formatMoney("A$", 1_200_000_000)).toBe("A$1.2bn");
    expect(sig2(0.3)).toBe(0.3);
    expect(String(sig2(9.2))).toBe("9.2");
    expect(formatMoney("£", 1_250_000_000)).toBe("£1.3bn");
  });

  it("words a range, and says 'about' when rounding makes both ends the same", () => {
    expect(rangeText(550, 880, (v) => formatMoney("£", v))).toBe("£550 to £880");
    expect(rangeQty(51_400, 62_900, "GWh")).toBe("51,000 to 63,000 GWh");
    expect(rangeQty(38_000, 38_300, "GWh")).toBe("about 38,000 GWh");
    expect(rangeText(700, 702, (v) => formatMoney("£", v))).toBe("about £700");
    expect(paybackText(9, 14)).toBe("9 to 14 years");
    expect(paybackText(9, null)).toContain("possibly longer than 50");
    expect(paybackText(null, null)).toBe("more than 50 years");
  });

  it("brackets the calculator's own result: cautious <= central <= optimistic, and central is that result", async () => {
    const i = inputs(birmingham);
    const results = await calculateSavings(i);
    const r = outcomeRange(results, i.arrays, i.batteryKWh, i.tariffs);
    expect(r.cautious.yearOneSaving).toBeLessThan(r.central.yearOneSaving);
    expect(r.central.yearOneSaving).toBeLessThan(r.optimistic.yearOneSaving);
    expect(r.cautious.generationKWh).toBeLessThan(r.optimistic.generationKWh);
    expect(r.cautious.pctMet).toBeLessThanOrEqual(r.optimistic.pctMet);
    expect(r.cautious.gridAvoidedKWh).toBeLessThanOrEqual(r.optimistic.gridAvoidedKWh);
    // The central case is the calculator's own number, not a re-derivation that could drift from it.
    expect(r.central.yearOneSaving).toBe(results.yearlySavings[0].importSaving + results.yearlySavings[0].exportSaving);
    expect(Math.round(r.central.generationKWh)).toBe(results.annualGenerationKWh);
    expect(r.central.paybackYears).toBe(results.paybackRows[1].paybackYears);
    // The cautious payback is never shorter than the optimistic one.
    expect(r.cautious.paybackYears ?? Infinity).toBeGreaterThanOrEqual(r.optimistic.paybackYears ?? Infinity);
  });
});

describe("the Homes report PDF", () => {
  for (const [name, location] of [["uk", birmingham], ["australia", sydney]] as [string, Location][]) {
    it(`${name}: is a tagged PDF/UA file with the household and decision-maker parts`, async () => {
      const { model, pdf } = await build(location, name);
      const raw = text(pdf);
      expect(raw.startsWith("%PDF-1.7")).toBe(true);
      expect(raw).toContain("/Marked true");
      expect(raw).toContain("pdfuaid:part");
      expect(raw).toContain("/Lang (en-GB)");
      const all = JSON.stringify(model.pages);
      expect(all).toContain("If you put solar and storage in your home");
      expect(all).toContain("If you are a policy maker");
      expect(all).toContain("Part A: your home");
      expect(all).toContain("Part B: what this means for a country");
      expect(all).toContain("About these figures");
      expect(all).not.toContain("undefined");
      expect(all).not.toContain("NaN");
      // Carbon is deliberately not claimed yet - the report may say it is left out, but must not state a figure.
      expect(all).not.toMatch(/tonnes|CO2|CO₂/i);
      expect(all).toContain("Carbon savings");
    });
  }

  it("gives ranges, not exact figures: the headline is a range and no exact calculator output appears", async () => {
    const { model, results } = await build(birmingham, "ranges");
    const all = JSON.stringify(model.pages);
    expect(model.pages[0].blocks.some((b) => b.type === "para" && / to /.test(b.text) && /year/.test(b.text))).toBe(true);
    const metrics = model.pages[0].blocks.find((b) => b.type === "metrics");
    if (metrics?.type !== "metrics") throw new Error("no metric tiles");
    expect(metrics.items.every((m) => /–|about|\+|>/.test(m.value))).toBe(true);
    // None of the exact outputs leaks into the wording.
    const exactSaving = results.yearlySavings[0].importSaving + results.yearlySavings[0].exportSaving;
    expect(all).not.toContain(`£${exactSaving.toLocaleString("en-GB")}`);
    expect(all).not.toContain(results.annualGenerationKWh.toLocaleString("en-GB"));
    expect(all).toContain("typical case");
  });

  it("never prints floating-point noise, and money in millions or billions has at most one decimal place", async () => {
    for (const [name, location] of [["uk", birmingham], ["australia", sydney]] as [string, Location][]) {
      const { model } = await build(location, `dp-${name}`);
      // Chart data (the raw numbers that set bar lengths and line heights) is not wording; strip it, then look for any number with 2+ decimals.
      const words = JSON.stringify(model.pages, (key, value) => (key === "values" || key === "value" || key === "widths" ? undefined : value));
      // Prices legitimately print as £0.20/kWh, and a small quantity as 0.38 kWh (two significant figures), but
      // nothing may print three or more decimals (9.200000000000001 and the like).
      expect(words.match(/.{20}\d+\.\d{3,}.{10}/g)).toBeNull();
      expect(words.match(/[£$€][\d,]*\d+\.\d{2,}(m|bn)/g)).toBeNull();
    }
  });

  it("uses solid colours only and makes no peak-demand claim", async () => {
    const { model } = await build(birmingham, "solid");
    const all = JSON.stringify(model.pages);
    expect(all).not.toContain('"pattern"');
    // The evening/peak reduction is not defensible until it is shown to hold on the worst solar day of the year.
    expect(all).not.toMatch(/evening|peak/i);
  });

  it("gives each bar chart its own legend by keeping the parts of each bar separate", async () => {
    const { model } = await build(birmingham, "legends");
    const split = model.pages.flatMap((p) => p.blocks).find((b) => b.type === "split");
    if (split?.type !== "split") throw new Error("no split chart");
    expect(split.rows).toHaveLength(2);
    expect(split.rows[0].parts.map((p) => p.name)).not.toEqual(split.rows[1].parts.map((p) => p.name));
  });

  it("puts the country flag on the cover as a described figure, and still builds without one", async () => {
    // Any small PNG stands in for a flag here; the real one comes from flagcdn at report time.
    const stand = file("../../../../public/favicon.png");
    const withFlag = await build(birmingham, "flag", stand);
    const cover = withFlag.model.pages[0].blocks.find((b) => b.type === "title");
    if (cover?.type !== "title") throw new Error("no title block");
    expect(cover.flag?.alt).toBe("Flag of United Kingdom");
    expect(text(withFlag.pdf)).toContain("Flag of United Kingdom");
    const without = await build(birmingham, "no-flag", null);
    expect(text(without.pdf).startsWith("%PDF-1.7")).toBe(true);
    expect(text(without.pdf)).not.toContain("Flag of");
  });

  it("shows the southern-hemisphere summer in January", async () => {
    const { model } = await build(sydney, "australia-seasons");
    expect(JSON.stringify(model.pages)).toContain("A typical summer day (Jan)");
  });

  it("scales the single home consistently: 100,000 homes is about ten times 10,000", async () => {
    const { model } = await build(birmingham, "scaling");
    const table = model.pages.flatMap((p) => p.blocks).find((b) => b.type === "table" && (b.caption ?? "").includes("this many homes"));
    if (table?.type !== "table") throw new Error("no scaling table");
    const row = table.rows.find((r) => r[0].startsWith("Electricity generated"))!;
    const highEnd = (s: string) => Number([...s.matchAll(/[\d,.]+/g)].map((m) => m[0].replace(/,/g, "")).at(-1));
    expect(highEnd(row[2])).toBeGreaterThanOrEqual(highEnd(row[1]) * 9);
    expect(highEnd(row[2])).toBeLessThanOrEqual(highEnd(row[1]) * 11);
  });
});
