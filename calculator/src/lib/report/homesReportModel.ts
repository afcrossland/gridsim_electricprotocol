import type { ChartSeries, ReportModel, ReportPage } from "../../../../shared/pdf/types";
import { currencyUnit } from "../currency";
import { MONTH_NAMES, MONTH_START_DAY, hoursForDay, monthlyTotals } from "../timeAggregates";
import type { Location, PanelArray, SavingsResults, Tariffs } from "../types";
import { formatMoney, formatQty, outcomeRange, paybackText, rangeQty, rangeText, roundMoney, roundPct } from "./ranges";

export interface HomesReportInput {
  location: Location;
  arrays: PanelArray[];
  batteryKWh: number;
  tariffs: Tariffs;
  results: SavingsResults;
  generatedOn: string;
  /** The country's flag as PNG bytes for the cover, or null/absent to leave it out. */
  flag?: Uint8Array | null;
}

/** GSC brand colours, as plain hex for the PDF. */
const BRAND = { primary: "#00ABBB", heading: "#008194", text: "#3B3838", line: "#E5E7EB", author: "Global Solar Council" };

/** Chart colours - the same identities as the calculator's own dispatch charts (lib/dispatchColors.ts). Solid fills only. */
const COLORS = {
  solar: "#FBB114",
  battery: "#00ABBB",
  grid: "#6B7280",
  charging: "#F97316",
  export: "#DC2626",
  demand: "#3B3838",
};

/** How many homes the decision-maker table scales to. */
const SCALE_HOMES = [10_000, 100_000, 1_000_000];

const sum = (a: ArrayLike<number>) => Array.from(a).reduce((x, y) => x + y, 0);
const HOUR_TICKS = [0, 6, 12, 18, 23].map((index) => ({ index, label: `${String(index).padStart(2, "0")}:00` }));
const homes = (n: number) => n.toLocaleString("en-GB");

/**
 * The report as pages of blocks. Part A answers "what do solar and storage do for my home"; Part B scales it up for
 * decision-makers. No figure is exact: headline numbers are a range between a cautious and an optimistic case (see
 * ranges.ts), rounded to sensible values; charts show the typical case.
 */
export function buildHomesReportModel(input: HomesReportInput): ReportModel {
  const { location, arrays, batteryKWh, tariffs, results, generatedOn, flag } = input;
  const symbol = currencyUnit(location.countryCode).split("/")[0];
  const money = (v: number) => formatMoney(symbol, v);
  const place = location.displayName.split(",")[0].trim() || location.displayName;
  const countryName = location.displayName.split(",").at(-1)?.trim() || place;

  const panels = arrays.reduce((a, x) => a + x.panels, 0);
  const kWp = arrays.reduce((a, x) => a + (x.panels * x.panelWatts) / 1000, 0);

  const r = outcomeRange(results, arrays, batteryKWh, tariffs);
  const { cautious, central, optimistic } = r;

  // ---- the typical case, from the calculator's own dispatch ----
  const d = results.dispatchHourly;
  const solarUsed = sum(d.solarToDemand);
  const fromBattery = sum(d.batteryDischarge);
  const fromGrid = sum(d.gridImport);
  const toBattery = sum(d.batteryCharge);
  const exported = sum(d.solarExport);
  const demandKWh = results.demandKWh;

  // ---- headline ranges ----
  const savingText = rangeText(cautious.yearOneSaving, optimistic.yearOneSaving, money);
  const savingDash = rangeText(cautious.yearOneSaving, optimistic.yearOneSaving, money, "–");
  const payback = paybackText(optimistic.paybackYears, cautious.paybackYears);
  const pctText = rangeText(cautious.pctMet, optimistic.pctMet, (v) => `${roundPct(v)}%`);
  const pctDash = rangeText(cautious.pctMet, optimistic.pctMet, (v) => `${roundPct(v)}%`, "–");
  /** A range scaled up to n homes, in the unit given by `fmt`. */
  const scaled = (pick: (o: typeof central) => number, n: number, fmt: (v: number) => string, div = 1) =>
    rangeText((pick(cautious) * n) / div, (pick(optimistic) * n) / div, fmt);
  /** A quantity range scaled up to n homes, with its unit shown once. */
  const scaledQty = (pick: (o: typeof central) => number, n: number, unit: string, div = 1) =>
    rangeQty((pick(cautious) * n) / div, (pick(optimistic) * n) / div, unit);

  // ---- charts (typical case) ----
  const summerMonth = location.lat < 0 ? 0 : 6;
  const winterMonth = location.lat < 0 ? 6 : 0;
  const dayOf = (month: number) => MONTH_START_DAY[month] + 14; // the 15th
  const dayChart = (month: number, name: string) => {
    const day = dayOf(month);
    const hours = (p: number[]) => hoursForDay(p, day);
    return {
      type: "bands" as const,
      title: `A typical ${name} day (${MONTH_NAMES[month]}) - local time`,
      unit: "kW",
      ticks: HOUR_TICKS,
      up: [
        { name: "Solar used in your home", color: COLORS.solar, values: hours(d.solarToDemand) },
        { name: "From your battery", color: COLORS.battery, values: hours(d.batteryDischarge) },
        { name: "From the grid", color: COLORS.grid, values: hours(d.gridImport) },
      ] satisfies ChartSeries[],
      down: [
        { name: "Charging your battery", color: COLORS.charging, values: hours(d.batteryCharge) },
        { name: "Sold back to the grid", color: COLORS.export, values: hours(d.solarExport) },
      ] satisfies ChartSeries[],
      alt: `Hour by hour on a typical ${name} day in ${MONTH_NAMES[month]}: solar generated about ${formatQty(sum(hours(results.generationProfile)))} kWh and your home used about ${formatQty(sum(hours(results.demandProfile)))} kWh; about ${formatQty(sum(hours(d.gridImport)))} kWh came from the grid and about ${formatQty(sum(hours(d.solarExport)))} kWh was sold back.`,
    };
  };

  const gen = monthlyTotals(results.generationProfile);
  const use = monthlyTotals(results.demandProfile);
  const horizon = results.yearlySavings.length;
  const cumulative = (cost: number) => {
    const out = [-cost];
    for (const row of results.yearlySavings) out.push(out[out.length - 1] + row.importSaving + row.exportSaving);
    return out;
  };
  const [lowRow, midRow, highRow] = results.paybackRows;
  const cashTicks = Array.from({ length: Math.floor(horizon / 5) + 1 }, (_, i) => ({ index: i * 5, label: String(i * 5) }));
  const cashChart = {
    type: "lines" as const,
    title: `Your money over ${horizon} years: cost of the system, less what it saves (${symbol})`,
    unit: symbol,
    ticks: cashTicks,
    series: [
      { name: "Lower cost estimate", color: COLORS.battery, values: cumulative(lowRow.installCost) },
      { name: "Typical cost", color: "#C98600", values: cumulative(midRow.installCost) },
      { name: "Higher cost estimate", color: COLORS.grid, values: cumulative(highRow.installCost), dashed: true },
    ],
    alt: `Typical-case cash position over ${horizon} years, starting about ${money(midRow.installCost)} behind for the typical cost. The line crosses zero - the system has paid for itself - after about ${midRow.paybackYears ?? "more than 50"} years for the typical cost, between ${lowRow.paybackYears ?? "more than 50"} and ${highRow.paybackYears ?? "more than 50"} years across the lower and higher cost estimates.`,
  };

  const yearRows = [1, 5, 10, 15, 20, 25].filter((y) => y <= horizon).map((y) => {
    const row = results.yearlySavings[y - 1];
    return [
      String(y),
      money(roundMoney(row.importSaving)),
      money(roundMoney(row.exportSaving)),
      money(roundMoney(row.importSaving + row.exportSaving)),
      money(roundMoney(cumulative(midRow.installCost)[y])),
    ];
  });

  // ---- pages ----
  const cover: ReportPage = {
    cover: true,
    blocks: [
      {
        type: "title",
        kicker: "Solar and storage at home",
        text: place,
        flag: flag ? { data: flag, alt: `Flag of ${countryName}` } : undefined,
        sub: `${panels} panels (${kWp.toFixed(1)} kWp) with a ${batteryKWh} kWh battery - generated ${generatedOn}` },
      { type: "heading", text: "If you put solar and storage in your home" },
      {
        type: "para",
        style: "lead",
        text: `A home like this one would typically save ${savingText} a year on its electricity bills, and the system would pay for itself in ${payback}. It would meet ${pctText} of the home's electricity from its own solar and battery.`,
      },
      {
        type: "metrics",
        items: [
          { label: "Saving in year one", value: savingDash },
          { label: "Own power", value: pctDash },
        ],
      },
      cashChart,
      { type: "heading", text: "If you are a policy maker" },
      {
        type: "para",
        text: `If 100,000 homes like this installed solar and storage, together they would save ${scaled((o) => o.yearOneSaving, 100_000, money)} on electricity bills in the first year, generate ${scaledQty((o) => o.generationKWh, 100_000, "GWh", 1e6)} a year, and take ${scaledQty((o) => o.gridAvoidedKWh, 100_000, "GWh", 1e6)} a year off the grid. Part B sets this out for 10,000, 100,000 and 1 million homes.`,
      },
      {
        type: "para",
        style: "small",
        text: "Figures are ranges, rounded, from a simple model of one typical home - not a quote or a forecast for a specific site. See \"About these figures\" for what they rest on.",
      },
    ],
  };

  const partA: ReportPage = {
    blocks: [
      { type: "heading", text: "Part A: your home" },
      {
        type: "split",
        title: "Where your electricity comes from, and where your solar goes (typical case)",
        unit: "kWh",
        rows: [
          {
            label: `Your home uses about ${formatQty(demandKWh)} kWh a year, supplied by`,
            parts: [
              { name: "Solar used directly", value: solarUsed, color: COLORS.solar, display: formatQty(solarUsed) },
              { name: "Your battery", value: fromBattery, color: COLORS.battery, display: formatQty(fromBattery) },
              { name: "The grid", value: fromGrid, color: COLORS.grid, display: formatQty(fromGrid) },
            ],
          },
          {
            label: `Your panels generate about ${formatQty(results.annualGenerationKWh)} kWh a year, which goes to`,
            parts: [
              { name: "Your home, directly", value: solarUsed, color: COLORS.solar, display: formatQty(solarUsed) },
              { name: "Charging your battery", value: toBattery, color: COLORS.charging, display: formatQty(toBattery) },
              { name: "Sold back to the grid", value: exported, color: COLORS.export, display: formatQty(exported) },
            ],
          },
        ],
        alt: `Your home uses about ${formatQty(demandKWh)} kWh a year: about ${formatQty(solarUsed)} kWh straight from your solar panels, ${formatQty(fromBattery)} kWh from your battery and ${formatQty(fromGrid)} kWh from the grid. Your panels generate about ${formatQty(results.annualGenerationKWh)} kWh: ${formatQty(solarUsed)} kWh used directly, ${formatQty(toBattery)} kWh into the battery and ${formatQty(exported)} kWh sold back to the grid.`,
      },
      dayChart(summerMonth, "summer"),
      dayChart(winterMonth, "winter"),
    ],
  };

  const partA2: ReportPage = {
    blocks: [
      {
        type: "columns",
        title: "Solar generated and your demand, month by month (typical case)",
        unit: "kWh",
        labels: MONTH_NAMES,
        series: [
          { name: "Solar generated", color: COLORS.solar, values: gen },
          { name: "Your demand", color: COLORS.demand, values: use },
        ],
        alt: `Monthly solar generation against home demand. Solar generation ranges from about ${formatQty(Math.min(...gen))} kWh in ${MONTH_NAMES[gen.indexOf(Math.min(...gen))]} to about ${formatQty(Math.max(...gen))} kWh in ${MONTH_NAMES[gen.indexOf(Math.max(...gen))]}; demand ranges from about ${formatQty(Math.min(...use))} to ${formatQty(Math.max(...use))} kWh a month.`,
      },
      {
        type: "table",
        caption: "What the system saves each year, and your running total (typical case, rounded)",
        head: ["Year", "Bill saved", "Sold back", "Total saved", "Running total, after cost"],
        rows: yearRows,
        widths: [0.1, 0.2, 0.2, 0.2, 0.3],
        alignRight: [1, 2, 3, 4],
      },
      {
        type: "para",
        style: "small",
        text: `The running total uses the typical installed cost of about ${money(midRow.installCost)} (lower ${money(lowRow.installCost)}, higher ${money(highRow.installCost)}). Bill savings grow each year with energy prices (${((tariffs.inflationRate - 1) * 100).toFixed(0)}% a year assumed); money earned from selling power back is held flat.`,
      },
    ],
  };

  const partB: ReportPage = {
    blocks: [
      { type: "heading", text: "Part B: what this means for a country" },
      {
        type: "para",
        text: `This takes the single home above and multiplies it, as if every one of those homes in your area installed the same system. It shows the size of the opportunity; it does not say how quickly homes would adopt. Each figure is a range between a cautious and an optimistic case.`,
      },
      {
        type: "table",
        caption: "If this many homes installed solar and storage",
        head: ["Each year", ...SCALE_HOMES.map((n) => `${homes(n)} homes`)],
        rows: [
          ["Solar capacity installed", ...SCALE_HOMES.map((n) => `${formatQty((kWp * n) / 1000)} MW`)],
          ["Electricity generated", ...SCALE_HOMES.map((n) => scaledQty((o) => o.generationKWh, n, "GWh", 1e6))],
          ["Electricity no longer drawn from the grid", ...SCALE_HOMES.map((n) => scaledQty((o) => o.gridAvoidedKWh, n, "GWh", 1e6))],
          ["Electricity sold back to the grid", ...SCALE_HOMES.map((n) => scaledQty((o) => o.exportedKWh, n, "GWh", 1e6))],
          ["Household bills saved (first year)", ...SCALE_HOMES.map((n) => scaled((o) => o.yearOneSaving, n, money))],
        ],
        widths: [0.31, 0.23, 0.23, 0.23],
        alignRight: [1, 2, 3],
      },
      {
        type: "list",
        items: [
          { lead: "For households.", text: `Each home keeps ${savingText} a year in the first year, rising with energy prices, and the system pays back in ${payback}.` },
          { lead: "For the grid.", text: `Each home draws ${rangeQty(cautious.gridAvoidedKWh, optimistic.gridAvoidedKWh, "kWh")} a year less from the grid.` },
          { lead: "For the country.", text: `The household savings above are money that stays with households instead of going on electricity bills. They are the size of the opportunity, not a forecast of how many homes would take it up.` },
        ],
      },
    ],
  };

  const about: ReportPage = {
    blocks: [
      { type: "heading", text: "About these figures" },
      {
        type: "list",
        items: [
          { lead: "Ranges and rounding.", text: `No figure here is exact. Headline numbers are a range between a cautious case (solar output 10% lower, energy prices 20% lower, installed cost 15% higher) and an optimistic case (the reverse), rounded to sensible values. Charts and tables show the typical case.` },
          { lead: "The home.", text: `${panels} panels of ${arrays[0]?.panelWatts ?? 0} W (${kWp.toFixed(1)} kWp) and a ${batteryKWh} kWh battery, in a home using about ${formatQty(demandKWh)} kWh of electricity a year.` },
          { lead: "Prices.", text: `Electricity bought by day ${symbol}${tariffs.importRateDay.toFixed(2)}/kWh and by night ${symbol}${tariffs.importRateNight.toFixed(2)}/kWh; sold back at ${symbol}${tariffs.exportRate.toFixed(2)}/kWh. These are example prices, shown with the local currency symbol but not converted from another currency or checked against your tariff.` },
          { lead: "Cost of the system.", text: `A simple estimate (a fixed amount, plus a cost per kW of panels and per kWh of battery), with a range of 15% either side. It is not a quote, and real prices vary by market.` },
          { lead: "Solar output.", text: `Estimated from a typical year for this country at a fixed panel angle, not from a survey of one roof. Roof direction and tilt are not yet applied.` },
          { lead: "Times of day.", text: `Shown in local solar time, so the sun is highest around 12:00 wherever you are. This is the sun's clock, not the wall clock: it ignores time zones and daylight saving, so it can differ from your clock by an hour or so.` },
          { lead: "Home demand.", text: `A typical daily pattern scaled to the annual figure above, not measured from a real home.` },
          { lead: "The battery.", text: `Solar covers the home first, any surplus charges the battery, and what is left is sold back. The battery covers the home when solar falls short. About 15% of the energy put into the battery is lost.` },
          { lead: "What is not included.", text: "Carbon savings, how well the system copes on the worst solar days, network charges and standing charges, tax, finance costs, panel and battery ageing, and the cost of replacing equipment." },
        ],
      },
      {
        type: "para",
        style: "small",
        text: "This report gives indicative figures to explore the value of solar and storage. It is not financial advice or a quotation.",
      },
    ],
  };

  return {
    title: "Solar Homes Calculator",
    documentTitle: `Solar and storage at home: ${place}`,
    lang: "en-GB",
    pages: [cover, partA, partA2, partB, about],
    footer: `Solar Homes Calculator - ${place} - ${generatedOn}`,
    pageOf: (n, total) => `Page ${n} of ${total}`,
    logoAlt: "Global Solar Council",
    brand: BRAND,
  };
}

/** "Solar Homes Calculator - Birmingham - 202610161530.pdf" */
export function homesReportFileName(location: Location, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
  const place = location.displayName.split(",")[0].trim().replace(/[\\/:*?"<>|]/g, "") || "report";
  return `Solar Homes Calculator - ${place} - ${stamp}.pdf`;
}

export function homesReportDate(now = new Date()): string {
  return now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
