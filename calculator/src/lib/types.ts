/** One year of hourly values, index 0 = Jan 1st 00:00 - always length 8760 (no leap-day hour). */
export type HourlyProfile = number[];

export interface Location {
  lat: number;
  lon: number;
  displayName: string;
  /** Lowercase ISO 3166-1 alpha-2, e.g. "gb". From Nominatim's own `address.country_code`. Not currently used to branch the calculation (see lib/calculate.ts - a GB-specific path existed briefly and will return later), kept on Location since it's a natural property of a place. */
  countryCode: string;
  /** The jurisdictions.json code (e.g. "GB", "US-CA") this location was picked from, when picked via a map click - undefined for a search-picked or deep-linked location, which has no map feature to highlight. Drives WorldMap.tsx's own selection outline. */
  mapCode?: string;
}

/** One roof-mounted (or ground-mounted) array - `SavingsInputs.arrays` is a list, ported from mygridgb's own multi-array "detailed" mode (its `arrays.map(...)` in `runCalc`), so "add another array" is a real, calculated thing, not just a UI stub. */
export interface PanelArray {
  panels: number;
  /** Wp per panel. */
  panelWatts: number;
  /** Degrees from horizontal, 0-90. */
  tilt: number;
  /** Degrees from south, -180 to 180 (mygridgb's own convention only goes 0-175 since GB panels never face north of due east/west - kept wider here for non-GB locations). */
  azimuth: number;
}

export type DemandBand = "low" | "medium" | "high";

export interface DemandInput {
  band: DemandBand;
  /** Explicit annual kWh - when omitted, falls back to the band's own default (see DEMAND_BAND_KWH). */
  annualKWh?: number;
}

export interface Tariffs {
  /** All rates in $/kWh for now - no real currency conversion/localisation yet, see ROADMAP.md. Split into day/night per Andrew's own instruction 2026-09-17 - see payback.ts's own NIGHT_HOURS for the (placeholder, not location-specific) day/night boundary this actually gets applied against. */
  importRateDay: number;
  importRateNight: number;
  exportRate: number;
  /** Annual price inflation, e.g. 1.03 for 3%/yr - drives the payback table's growing-saving projection (ported from mygridgb's own `inflRate`). */
  inflationRate: number;
}

/**
 * A flat annual kWh added to demand when `SavingsInputs.evCharging` is on -
 * a rough, commonly-cited UK home EV-charging estimate (~8,000 miles/yr at
 * a typical efficiency), not a real per-vehicle/per-market figure and not
 * time-shaped (a real EV charging load is heavily overnight-weighted, which
 * this flat addition doesn't capture - see ROADMAP.md's "Known gaps").
 * Flagged 2026-09-16, not an oversight.
 */
export const EV_ANNUAL_KWH_DUMMY = 2900;

export interface SavingsInputs {
  location: Location;
  arrays: PanelArray[];
  batteryKWh: number;
  demand: DemandInput;
  /** Adds EV_ANNUAL_KWH_DUMMY to the demand total - see its own doc comment. */
  evCharging: boolean;
  tariffs: Tariffs;
}

export interface PaybackRow {
  installCost: number;
  /** Pre-tax, unlevered IRR (e.g. 0.082 for 8.2%/yr) over payback.ts's own CASH_FLOW_HORIZON_YEARS, or null if lifetime savings never recover the cost even undiscounted - see payback.ts's own computeIRR. */
  irr: number | null;
  /** Number of years, or null if it doesn't pay back within 50 years (mirrors mygridgb's own '>50' sentinel). */
  paybackYears: number | null;
}

/** One row of the year-by-year saving table - see payback.ts's own computeYearlySavings. */
export interface YearlySaving {
  year: number;
  /** Avoided grid-import cost this year, grows with Tariffs.inflationRate. */
  importSaving: number;
  /** Export tariff revenue this year, held flat (not inflation-adjusted). */
  exportSaving: number;
}

/** Hour-by-hour dispatch breakdown, for the Dispatch tab's own charts - see lib/batteryDispatch.ts's own DispatchResult. */
export interface DispatchHourly {
  solarToDemand: HourlyProfile;
  batteryCharge: HourlyProfile;
  batteryDischarge: HourlyProfile;
  gridImport: HourlyProfile;
  solarExport: HourlyProfile;
  batteryLevelPct: HourlyProfile;
}

export interface SavingsResults {
  /** The raw 8760-hour generation profile (summed across every array, before battery dispatch) in kWh/hour - "the 8760 output multiplied by the PV size", for the Generation & Demand tab's charts. */
  generationProfile: HourlyProfile;
  /** The same 8760-hour demand profile the dispatch simulation itself ran against (demandProfile.ts's own shape, scaled to this system's actual annual demand) - shown alongside generationProfile on the Generation & Demand tab so the two are always the same system, not one real and one illustrative. */
  demandProfile: HourlyProfile;
  /** The same dispatch that produced selfConsumedKWh/exportedKWh below, broken out hour-by-hour - for the Dispatch tab. */
  dispatchHourly: DispatchHourly;
  annualGenerationKWh: number;
  selfConsumedKWh: number;
  exportedKWh: number;
  /** Total annual demand this result was computed against (the band/custom kWh, plus EV charging if on) - lets the UI show "from grid" as demandKWh - selfConsumedKWh without re-deriving it from pctDemandMet. */
  demandKWh: number;
  /** selfConsumedKWh / demand, as a percentage (0-100, capped there) to 1dp - mirrors mygridgb's own `pctMet`, rounded to 1dp instead of a whole percent per Andrew's own instruction 2026-09-18. */
  pctDemandMet: number;
  /** Low/mid/high install-cost estimate rows - see lib/payback.ts. */
  paybackRows: PaybackRow[];
  /** Year-by-year saving breakdown (import saving vs export revenue), independent of install cost - see lib/payback.ts's own computeYearlySavings. */
  yearlySavings: YearlySaving[];
  /** Which calculation path actually ran - surfaced so the Results UI can show its provenance ("MCS MGD003 data for Great Britain" vs "a placeholder generation profile, not yet specific to this location"). */
  source: "gb-mcs" | "generic";
}
