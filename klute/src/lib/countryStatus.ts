import seed from "../../../src/data/protocol.seed.json";
import jurisdictions from "../../../src/data/jurisdictions.json";
import solar from "../../../deployment/src/data/ember_solar.json";
import generation from "../../../deployment/src/data/ember_generation.json";
import irradiance from "../../../calculator/src/data/country-irradiance.json";
import selfSufficiency from "../../../calculator/src/data/country-self-sufficiency.json";
import { seedResponses } from "../../../src/stores/protocolStore";
import { scoreCountry } from "../../../src/lib/scoring";
import type { Protocol, Question } from "../../../src/lib/types";
import { monthRow, yearRow } from "./coverage";
import type { FgsCoverage } from "./fgs";

export type LayerId = "fgsGen" | "fgsDem" | "fgsCap" | "policy" | "depCap" | "depShare" | "calcIrr" | "calcSelf";

export interface LayerDef {
  id: LayerId;
  label: string;
  explorer: string;
}

export const LAYERS: LayerDef[] = [
  { id: "fgsGen", label: "Generation", explorer: "Future Grid Simulator" },
  { id: "fgsDem", label: "Demand", explorer: "Future Grid Simulator" },
  { id: "fgsCap", label: "Capacity", explorer: "Future Grid Simulator" },
  { id: "policy", label: "Policy", explorer: "Policy Explorer" },
  { id: "depCap", label: "Solar capacity", explorer: "Deployment Explorer" },
  { id: "depShare", label: "Solar share", explorer: "Deployment Explorer" },
  { id: "calcIrr", label: "Irradiance", explorer: "Solar Homes Calculator" },
  { id: "calcSelf", label: "Self-sufficiency", explorer: "Solar Homes Calculator" },
];

export interface LayerState {
  has: boolean;
  /** Human-readable summary, e.g. "2015-01 → 2026-08 · 96%" */
  detail: string;
  /** 0..1 where the layer has a meaningful completeness figure */
  pct?: number;
  /** The layer could not be checked (e.g. the simulator is unreachable): neither present nor missing. */
  unknown?: boolean;
}

export interface CountryStatus {
  code: string;
  name: string;
  layers: Record<LayerId, LayerState>;
  /** share of checkable layers that are present, 0..1 */
  score: number;
  missing: LayerId[];
}

interface Jur {
  code: string;
  name: string;
  level: string;
  parent: string | null;
}
const jurs = jurisdictions as unknown as Jur[];
const protocol = seed as unknown as Protocol;
const questions = seed.questions as unknown as Question[];

/** The country a jurisdiction rolls up to (its parent for states and provinces). */
export function countryOf(code: string): string {
  const j = jurs.find((x) => x.code === code);
  return j?.parent && j.level !== "country" ? j.parent : code;
}

export const COUNTRY_CODES = jurs.filter((j) => j.level === "country").map((j) => j.code);

interface FgsInput {
  generation?: FgsCoverage;
  demand?: FgsCoverage;
  capacity?: FgsCoverage;
  /** simulator region -> country; absent when it could not be loaded */
  regionCountries?: Record<string, string>;
}

const span = (first: string, last: string, pct: number) => `${first} → ${last} · ${Math.round(pct * 100)}%`;

function fgsLayer(cov: FgsCoverage | undefined, regionCountries: Record<string, string> | undefined, country: string): LayerState {
  if (!cov) return { has: false, unknown: true, detail: "simulator not reachable" };
  const mine = cov.regions.filter((r) => (regionCountries?.[r.region_code] ?? r.region_code) === country);
  if (!mine.length) return { has: false, detail: "no regions with data" };
  const rows = mine.map((r) => (cov.kind === "years" ? yearRow(r.region_code, r.region_code, r.years ?? []) : monthRow(r.region_code, r.region_code, r.months ?? {})));
  const best = rows.reduce((a, b) => (b.completeness > a.completeness ? b : a));
  const regionNote = rows.length > 1 ? `${rows.length} regions, best ` : "";
  return { has: true, pct: best.completeness, detail: `${regionNote}${span(best.first, best.last, best.completeness)}` };
}

export function buildCountryStatus(fgs: FgsInput): CountryStatus[] {
  const responses = seedResponses();
  const answeredBy = new Map<string, string[]>();
  for (const r of responses) (answeredBy.get(r.countryCode) ?? answeredBy.set(r.countryCode, []).get(r.countryCode)!).push(r.questionId);

  // Policy answers sit on states for subdivided countries (AU, US): fold them into the country.
  const policyBest = new Map<string, { completeness: number; answered: number; via: string }>();
  for (const code of answeredBy.keys()) {
    const s = scoreCountry(protocol, questions, responses, code, code);
    const c = countryOf(code);
    const cur = policyBest.get(c);
    if (!cur || s.completeness > cur.completeness) policyBest.set(c, { completeness: s.completeness, answered: s.answered, via: code === c ? "" : ` (best: ${code})` });
  }

  const solarData = solar.countries as unknown as Record<string, { annualSeries?: { year: number }[]; series?: { year: number }[] }>;
  const genData = generation.countries as unknown as Record<string, { series: { year: number }[] }>;
  const irr = irradiance as unknown as Record<string, unknown>;
  const self = selfSufficiency as unknown as Record<string, unknown>;
  const years = (list?: { year: number }[]) => (list?.length ? `${Math.min(...list.map((p) => p.year))} → ${Math.max(...list.map((p) => p.year))}` : "");

  return jurs
    .filter((j) => j.level === "country")
    .map((j) => {
      const code = j.code;
      const pol = policyBest.get(code);
      const sol = solarData[code];
      const solYears = years(sol?.annualSeries ?? sol?.series);
      const gen = genData[code];
      const layers: Record<LayerId, LayerState> = {
        fgsGen: fgsLayer(fgs.generation, fgs.regionCountries, code),
        fgsDem: fgsLayer(fgs.demand, fgs.regionCountries, code),
        fgsCap: fgsLayer(fgs.capacity, fgs.regionCountries, code),
        policy: pol ? { has: true, pct: pol.completeness, detail: `${pol.answered}/${questions.length} answered · ${Math.round(pol.completeness * 100)}% complete${pol.via}` } : { has: false, detail: "no answers" },
        depCap: solYears ? { has: true, detail: solYears } : { has: false, detail: "no Ember capacity series" },
        depShare: gen?.series?.length ? { has: true, detail: years(gen.series) } : { has: false, detail: "no Ember generation series" },
        calcIrr: irr[code] ? { has: true, detail: "profile available" } : { has: false, detail: "no irradiance profile" },
        calcSelf: self[code] ? { has: true, detail: "table available" } : { has: false, detail: "no self-sufficiency table" },
      };
      const checkable = LAYERS.filter((l) => !layers[l.id].unknown);
      const present = checkable.filter((l) => layers[l.id].has).length;
      return {
        code,
        name: j.name,
        layers,
        score: checkable.length ? present / checkable.length : 0,
        missing: checkable.filter((l) => !layers[l.id].has).map((l) => l.id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
