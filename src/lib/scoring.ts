import { getJurisdiction, jurisdictionName } from "./jurisdictions";
import { GSC_RAMP } from "../../shared/lib/mapColor";
import type {
  CountryScore,
  GroupedScore,
  ImpactItem,
  Protocol,
  Question,
  Response,
  Section,
} from "./types";

/**
 * Ceiling a rubric tier's `points` can be set to in the admin console, and
 * what `scoreCountry` and `rankImpact` normalise a question against - fixed
 * globally rather than per question, so a question whose tiers are all set
 * below 4 simply cannot contribute its full share, by admin choice. This is
 * the scoring ceiling now, not `protocol.maxScore` (which stays 2, the count
 * of rubric steps above zero - a display concern, not a scoring one).
 */
export const MAX_TIER_POINTS = 4;

/** Points a response earns, looked up from the question's own rubric definition. */
function tierPoints(question: Question, rawScore: number): number {
  return question.rubric.find((t) => t.score === rawScore)?.points ?? rawScore;
}

/**
 * Weighted score normalised over *answered* weight only, then discounted by
 * completeness.
 *
 * The spreadsheet divides by the weight of every question, which scores an
 * unanswered question as if it were a zero and makes a partly-filled country
 * look far worse than it is - so the achievement rate itself, `rawScore`, is
 * computed over what has actually been answered, meaning "of the policy you
 * have told us about, this is how much is in place". Left there, though, a
 * jurisdiction that answers only its handful of heaviest-weighted questions
 * and scores full marks on those can out-rank one with much broader (if more
 * mixed) coverage - answering less is never a way to score higher, so the
 * achievement rate is multiplied by completeness to get the score this
 * function actually returns. A jurisdiction at exactly the completeness
 * threshold with a perfect answered-only rate is not shown as if it were
 * fully evidenced; one with full coverage is unaffected (completeness 1
 * leaves rawScore unchanged).
 *
 * This discount only applies once a jurisdiction clears `ranked` - below
 * threshold, `ranked` is false and every caller shows "not enough data"
 * rather than a number, so an unresearched jurisdiction is never shown a
 * fake low score instead of no score at all.
 */
export function scoreCountry(
  protocol: Protocol,
  questions: Question[],
  responses: Response[],
  code: string,
  name: string,
  /** Overrides the protocol's default completeness threshold when supplied. */
  threshold?: number,
): CountryScore {
  const byId = new Map(responses.filter((r) => r.countryCode === code).map((r) => [r.questionId, r]));

  let answeredWeight = 0;
  let earned = 0;
  let answered = 0;
  const totalWeight = questions.reduce((sum, q) => sum + q.weight, 0);

  for (const q of questions) {
    const r = byId.get(q.id);
    if (!r) continue;
    answered += 1;
    answeredWeight += q.weight;
    earned += q.weight * tierPoints(q, r.score);
  }

  const rawScore = answeredWeight > 0 ? earned / (answeredWeight * MAX_TIER_POINTS) : 0;
  const completeness = totalWeight > 0 ? answeredWeight / totalWeight : 0;

  return {
    code,
    name,
    score: rawScore * completeness,
    completeness,
    answered,
    total: questions.length,
    ranked: completeness >= (threshold ?? protocol.completenessThreshold),
  };
}

/**
 * A jurisdiction's score broken down per section - the section radar's data
 * source. Reuses `scoreCountry` itself, scoped to each section's own
 * questions in turn, so a section's score carries exactly the same
 * completeness discount and `ranked` gate as the overall figure - no
 * separate formula to keep in sync.
 */
export function scoreSections(
  protocol: Protocol,
  sections: Section[],
  questions: Question[],
  responses: Response[],
  code: string,
  threshold?: number,
): { section: Section; score: CountryScore }[] {
  return sections.map((section) => {
    const sectionQuestions = questions.filter((q) => q.sectionId === section.id);
    return {
      section,
      score: scoreCountry(protocol, sectionQuestions, responses, code, section.title, threshold),
    };
  });
}

/**
 * Every one of `codes` scored against just this one section, ranked
 * best-first - the data an "exemplar" or "who leads this section" view
 * needs (see CountryPanel.tsx's Overview tab and its Policy Landscape
 * exemplar callout). `name` is left as `code` rather than threaded through
 * from a jurisdiction-name lookup - callers already have `allScores` (or
 * equivalent) in scope to resolve a display name/flag, and this function's
 * own job is just the ranking, not display concerns.
 *
 * Scoped to a caller-supplied `codes` list rather than discovering
 * candidates itself, so it stays a pure function of whatever the caller
 * already knows exists (the same `allScores`/`scores` array App.tsx already
 * assembles) rather than a second, possibly-inconsistent notion of "every
 * jurisdiction."
 */
export function sectionLeaderboard(
  protocol: Protocol,
  section: Section,
  questions: Question[],
  responses: Response[],
  codes: string[],
  threshold?: number,
): CountryScore[] {
  const sectionQuestions = questions.filter((q) => q.sectionId === section.id);
  return codes
    .map((code) => scoreCountry(protocol, sectionQuestions, responses, code, code, threshold))
    .filter((s) => s.ranked)
    .sort((a, b) => b.score - a.score);
}

/**
 * Where a country's own section score sits relative to the field - the
 * "are we leading" half of Q2 that `scoreBand()`'s absolute Very
 * ineffective..Very effective band can't answer on its own (a country can
 * be "Effective" in absolute terms while still trailing a strong field, or
 * "Ineffective" while still leading a field that's broadly worse). Needs at
 * least MIN_FIELD_SIZE *other* ranked countries in `leaderboard` to say
 * anything meaningful - returns "insufficient" below that rather than a
 * falsely confident band off one or two data points.
 */
const MIN_FIELD_SIZE = 4;

export type SectionStanding = "leading" | "typical" | "behind" | "insufficient";

export function sectionStanding(ownScore: CountryScore, leaderboard: CountryScore[]): SectionStanding {
  const field = leaderboard.filter((s) => s.code !== ownScore.code);
  if (!ownScore.ranked || field.length < MIN_FIELD_SIZE) return "insufficient";
  const betterCount = field.filter((s) => s.score > ownScore.score).length;
  const percentile = 1 - betterCount / field.length; // 1 = best in the field
  if (percentile >= 0.75) return "leading";
  if (percentile <= 0.25) return "behind";
  return "typical";
}

/** Same hues as SCORE_BANDS' own ends (amber for strong, teal for weak) - a relative standing and an absolute band are different judgements, but reusing the same two hues keeps "good" reading as the same colour everywhere in the app. */
export const SECTION_STANDING_COLORS: Record<SectionStanding, string> = {
  leading: "#FBB114",
  typical: "#6B7280",
  behind: "#00ABBB",
  insufficient: "#9CA3AF",
};

const SECTION_STANDING_LABELS: Record<SectionStanding, string> = {
  leading: "Leading",
  typical: "Typical",
  behind: "Behind the field",
  insufficient: "Not enough data to compare",
};

const SECTION_STANDING_LABEL_TRANSLATIONS: Record<SectionStanding, Record<string, string>> = {
  leading: { es: "A la cabeza", fr: "En tête" },
  typical: { es: "Típico", fr: "Typique" },
  behind: { es: "Por detrás del grupo", fr: "En retard sur le groupe" },
  insufficient: { es: "Datos insuficientes para comparar", fr: "Données insuffisantes pour comparer" },
};

export function sectionStandingLabel(standing: SectionStanding, language = "en"): string {
  return SECTION_STANDING_LABEL_TRANSLATIONS[standing]?.[language] ?? SECTION_STANDING_LABELS[standing];
}

/**
 * Highest-impact changes for a country: every *answered* question that is not
 * already at full marks, ranked by the weighted points it would gain from
 * being taken to the top of its rubric.
 *
 * Unanswered questions are deliberately excluded - this list is about policy
 * gaps that are known and confirmed, not about missing research. Finding an
 * unanswered question is a separate task, done by filtering the questions
 * list on the Answer the questions page rather than by inflating this list
 * with unknowns.
 */
export function rankImpact(
  protocol: Protocol,
  questions: Question[],
  sections: Section[],
  responses: Response[],
  code: string,
): ImpactItem[] {
  const byId = new Map(responses.filter((r) => r.countryCode === code).map((r) => [r.questionId, r]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  // Denominator the country's score is currently divided by. Taking a question
  // to full marks also adds its weight here when it was previously unanswered,
  // which is why the delta is computed against a recomputed score rather than
  // assumed proportional to the gain.
  const current = scoreCountry(protocol, questions, responses, code, code);
  const answeredWeight = questions.reduce(
    (sum, q) => (byId.has(q.id) ? sum + q.weight : sum),
    0,
  );
  const earned = questions.reduce(
    (sum, q) => sum + q.weight * tierPoints(q, byId.get(q.id)?.score ?? 0),
    0,
  );

  const items: ImpactItem[] = [];

  for (const q of questions) {
    const r = byId.get(q.id);
    if (!r) continue; // unanswered: a research gap, not a ranked policy gap

    const currentScore = r.score;
    const gain = q.weight * (MAX_TIER_POINTS - tierPoints(q, currentScore));
    if (gain <= 0) continue;

    // Taking an already-answered question to full marks does not change
    // completeness, so the same completeness multiplier applies to both
    // sides of the delta - only the answered-only rate moves.
    const nextEarned = earned + gain;
    const nextRawScore = answeredWeight > 0 ? nextEarned / (answeredWeight * MAX_TIER_POINTS) : 0;
    const nextScore = nextRawScore * current.completeness;

    items.push({
      question: q,
      section: sectionById.get(q.sectionId)!,
      currentScore,
      gain,
      scoreDelta: nextScore - current.score,
    });
  }

  // Rank by raw weighted points available, which is the stable measure of what
  // is worth fixing. scoreDelta is shown but not sorted on: an unanswered
  // question can dilute the denominator enough to give a negative delta while
  // still being a real gap worth closing.
  return items.sort((a, b) => b.gain - a.gain || a.question.order - b.question.order);
}

/**
 * Group country scores for the scoreboard, by sovereign state. Political blocs such as the EU are NOT grouped: every
 * EU member is its own row, as in the Deployment Explorer and the Solar Homes Calculator (changed 2026-10-23 so the
 * three apps are consistent).
 *
 * Two different shapes of row come out of this:
 *
 * - A subdivided country (Australia, the US, Canada) has no score of its own -
 *   its row's score is the average across whichever of its states/provinces
 *   are individually `ranked`. Averaging in an unranked child would let one
 *   thinly-evidenced province drag the whole country's figure toward zero on
 *   almost no data, the same distortion the per-jurisdiction threshold exists
 *   to prevent - so a group is `ranked` only when at least one child is, and
 *   the average is taken over ranked children alone.
 * - A country with exclaves but its own mappable shape (France) is different:
 *   "FR" already has a real, directly-evidenced score, so that stays the row's
 *   score untouched. The exclaves appear as children for the breakdown, but
 *   are never averaged into it - they are additional jurisdictions, not
 *   missing pieces of France's own figure.
 */
export function groupScores(scores: CountryScore[], language = "en"): GroupedScore[] {
  const byCode = new Map(scores.map((s) => [s.code, s]));
  const childrenByParent = new Map<string, CountryScore[]>();
  const hiddenFromTopLevel = new Set<string>();

  // ISO subdivision: a country's states/provinces/exclaves roll up under it.
  for (const s of scores) {
    const parent = getJurisdiction(s.code)?.parent;
    if (!parent) continue;
    const list = childrenByParent.get(parent) ?? [];
    list.push(s);
    childrenByParent.set(parent, list);
    hiddenFromTopLevel.add(s.code);
  }

  const grouped: GroupedScore[] = [];

  for (const s of scores) {
    if (hiddenFromTopLevel.has(s.code)) continue; // shown under its parent below
    const children = childrenByParent.get(s.code) ?? [];
    grouped.push({
      code: s.code,
      name: s.name,
      isGroup: children.length > 0,
      children,
      score: s.score,
      completeness: s.completeness,
      ranked: s.ranked,
      rankedChildren: children.filter((c) => c.ranked).length,
      totalChildren: children.length,
      hasOwnScore: true,
    });
  }

  // Subdivided countries (AU, US, CA) have children but never appear as a
  // CountryScore themselves - their group row is built from the children alone.
  for (const [parentCode, children] of childrenByParent) {
    if (byCode.has(parentCode)) continue;
    grouped.push(syntheticGroup(parentCode, jurisdictionName(parentCode, language), children));
  }

  return grouped;
}

/** A group row with no score of its own - averaged over whichever children are ranked. */
function syntheticGroup(code: string, name: string, children: CountryScore[]): GroupedScore {
  const ranked = children.filter((c) => c.ranked);
  const score = ranked.length > 0 ? ranked.reduce((sum, c) => sum + c.score, 0) / ranked.length : 0;
  const completeness =
    ranked.length > 0 ? ranked.reduce((sum, c) => sum + c.completeness, 0) / ranked.length : 0;

  return {
    code,
    name,
    isGroup: true,
    children,
    score,
    completeness,
    ranked: ranked.length > 0,
    rankedChildren: ranked.length,
    totalChildren: children.length,
    hasOwnScore: false,
  };
}

/**
 * Colour ramp for the choropleth, low score to high - teal/aqua to amber
 * via a pale warm cream midpoint. Now just this app's own name for
 * `shared/lib/mapColor.ts`'s `GSC_RAMP`, confirmed byte-identical to
 * deployment's and calculator's own ramps before being centralized there
 * 2026-09-19; kept as its own export here (rather than switching every
 * caller in this file to `GSC_RAMP` directly) since `scoreColor()` and
 * the map's own fill expression read as "the score ramp," not "the
 * shared map ramp," in this app's own vocabulary.
 */
export const SCORE_RAMP = GSC_RAMP;

/**
 * Countries below the completeness threshold, and those with no data at all, are painted the same grey and both
 * called "not enough data" in the legend (merged 2026-10-23 - they used to be two greys, "#D1D5DB" and "#EDEBE4", with
 * two legend labels). Two names remain because the map's fill expression still distinguishes the two cases; they just
 * resolve to one colour. This warm grey is local rather than `shared/lib/mapColor.ts`'s own `COLOR_NO_DATA`
 * ("#E5E7EB"), so the Policy map keeps its own look.
 */
export const COLOR_NO_DATA = "#EDEBE4";
export const COLOR_INSUFFICIENT = COLOR_NO_DATA;

export function scoreColor(score: number): string {
  let chosen: string = SCORE_RAMP[0].color;
  for (const s of SCORE_RAMP) {
    if (score >= s.stop) chosen = s.color;
  }
  return chosen;
}

/**
 * A bare score percentage reads as more precise than the underlying data
 * actually supports, and invites comparing "68% vs 71%" as if that gap were
 * meaningful. Everywhere a score is shown to a reader, it is banded into one
 * of these five instead - the percentage still drives which band and colour
 * a score gets, it is just never printed. Equal-width quintiles, using the
 * same five colours as the map's continuous SCORE_RAMP (same order, same
 * hues) so a banded label and the choropleth always agree on what a colour
 * means.
 */
export const SCORE_BANDS = [
  { label: "Very ineffective", min: 0.0, color: "#00ABBB" },
  { label: "Ineffective", min: 0.2, color: "#7AC8C1" },
  { label: "Moderate", min: 0.4, color: "#F5E6C8" },
  { label: "Effective", min: 0.6, color: "#F8CB6E" },
  { label: "Very effective", min: 0.8, color: "#FBB114" },
] as const;

export function scoreBand(score: number): (typeof SCORE_BANDS)[number] {
  let chosen: (typeof SCORE_BANDS)[number] = SCORE_BANDS[0];
  for (const b of SCORE_BANDS) {
    if (score >= b.min) chosen = b;
  }
  return chosen;
}

/**
 * The colour to use wherever a score is shown as text or as its suns (score labels, the sun rating, the PDF report):
 * the sun rating's own colour, from SUN_COLORS below. A band's own `color` is calibrated to be a map fill and a
 * swatch, not text - the pale cream of the 1-sun band (#F5E6C8) is close to unreadable on a white/paper background -
 * so use this rather than `scoreBand(...).color` for anything a reader has to read.
 *
 * 1 sun is the one colour that needs adjusting to be legible as text: a darker brown on a light surface, and a lighter
 * gold on a dark one (the light-mode brown #8A6D23 read as too close to the dark-mode paper background to tell apart,
 * flagged 2026-10-09). `mode` defaults to "light" (the PDF report is always a printable light page, so its call sites
 * never pass it); live UI call sites pass `theme.palette.mode`.
 */
export function scoreTextColor(score: number, mode: "light" | "dark" = "light"): string {
  const suns = scoreSuns(score);
  if (suns === 1) return mode === "dark" ? "#E8C97A" : "#8A6D23"; // cream, darkened/lightened to read as text
  return SUN_COLORS[suns];
}

/**
 * Sun-rating colours (set 2026-10-15 for the old star rating, per Andrew's own instruction; renamed when stars became
 * suns, and flipped on 2026-10-21 when the map ramp was inverted to teal for low and amber for high):
 * 1 sun is cream (see scoreTextColor above for its legible variants), 2 suns teal, 3 suns light teal, 4 suns light
 * amber, 5 suns amber. The same hues as the map ramp, but deliberately independent of SCORE_BANDS' own colours (where
 * 1 is teal and 3 is cream), which drive the map fill and the answer ladder's edge.
 */
const SUN_COLORS: Record<number, string> = {
  1: "#F5E6C8",
  2: "#00ABBB",
  3: "#7AC8C1",
  4: "#F8CB6E",
  5: "#FBB114",
};

/**
 * `SCORE_BANDS`' own `label` (and `NOT_ENOUGH_DATA_BAND` in
 * scoreboardFilters.ts) stay plain English identifiers - they're used as
 * filter values/matching keys (ScoreboardFilters.tsx's band chips,
 * scoreboardFilters.ts's `matchesFilters`), not just display text, so
 * they can't be swapped for a translated string outright. This is the
 * display-only translation for wherever a band's *name* is actually shown
 * to a reader - same "raw value for logic, translated label for display"
 * split as CONTINENTS/Deployment Explorer's own metric keys.
 */
const BAND_LABEL_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Very ineffective": { es: "Muy ineficaz", fr: "Très inefficace" },
  Ineffective: { es: "Ineficaz", fr: "Inefficace" },
  // English override, not a translation - renamed from "Moderate" per
  // Andrew's own instruction 2026-10-09, a softer framing for a jurisdiction
  // sitting in the middle of the band ("could be better" names the
  // opportunity, where "Moderate" just described the number). es/fr keep
  // their existing neutral "Moderate" translations rather than following
  // suit - a tone shift like this is a copy decision for that language's
  // own reviewer, not something to carry over by default.
  Moderate: { en: "Could do better", es: "Moderado", fr: "Modéré" },
  Effective: { es: "Eficaz", fr: "Efficace" },
  "Very effective": { es: "Muy eficaz", fr: "Très efficace" },
  // Not a real band - scoreboardFilters.ts's NOT_ENOUGH_DATA_BAND, included
  // here too so ScoreboardFilters.tsx's band chips can translate every chip
  // through the same bandLabelText() call regardless of which one it is.
  "Not enough data": { es: "Datos insuficientes", fr: "Données insuffisantes" },
};

/** Sun rating (1-5) for a band: its position in SCORE_BANDS, "Very ineffective" = 1 through "Very effective" = 5. */
export function bandSunCount(label: string): number | null {
  const i = SCORE_BANDS.findIndex((b) => b.label === label);
  return i === -1 ? null : i + 1;
}

/** How many suns (1-5) a score earns - the app shows scores as suns (components/ui/Suns.tsx), never as band names. */
export function scoreSuns(score: number): number {
  return bandSunCount(scoreBand(score).label)!;
}

/** A band's name, or NOT_ENOUGH_DATA_BAND's, translated - for the places that name a band rather than draw its suns. */
export function bandLabelText(label: string, language = "en"): string {
  return BAND_LABEL_TRANSLATIONS[label]?.[language] ?? label;
}

/** Ceiling of the 0-5 impact (question weight) scale editable in the admin console. */
export const MAX_IMPACT = 5;

/**
 * Yellow-to-green colour coding for a question's impact, so its relative
 * priority reads at a glance instead of as a bare number. Borrows GSC's own
 * Bright Yellow for the low end (reserved for gradients, unused elsewhere in
 * the theme); the brand palette has no green, so the high end is a plain,
 * unbranded green chosen just to read clearly against the yellow.
 */
const IMPACT_LOW_RGB = [255, 243, 74] as const; // #FFF34A, GSC Bright Yellow
const IMPACT_HIGH_RGB = [46, 125, 50] as const; // #2E7D32

export function impactColor(weight: number): string {
  const t = Math.min(1, Math.max(0, weight / MAX_IMPACT));
  const [r, g, b] = IMPACT_LOW_RGB.map((c, i) => Math.round(c + (IMPACT_HIGH_RGB[i] - c) * t));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Readable text colour against impactColor() at the same weight. */
export function impactTextColor(weight: number): string {
  const t = Math.min(1, Math.max(0, weight / MAX_IMPACT));
  return t > 0.5 ? "#FFFFFF" : "#3B3838"; // GSC Deep Gray at the yellow end
}

/**
 * A bare weight like "0.3" or "2" reads as more precise than a reader can
 * actually use it for - what matters is roughly how much a question counts,
 * not the exact figure. Everywhere a question's Impactfullness is shown, it is
 * banded into one of these five instead; the underlying weight (still 0-5,
 * still editable to a decimal in the admin console) is what the maths - and
 * impactColor()'s gradient - keeps using. Equal-width quintiles of
 * MAX_IMPACT, so today's spreadsheet weights (0.3 up to 3) land mostly in
 * the lower bands rather than being spread across the full scale - 0.3 in
 * particular falls in "Very low", same as the lightest weight in the data.
 */
export const IMPACT_BANDS = [
  { label: "Very low", min: 0 },
  { label: "Low", min: 1 },
  { label: "Moderate", min: 2 },
  { label: "High", min: 3 },
  { label: "Very high", min: 4 },
].map((b) => ({ ...b, color: impactColor(b.min + 0.5) }));

export function impactBand(weight: number): (typeof IMPACT_BANDS)[number] {
  let chosen = IMPACT_BANDS[0];
  for (const b of IMPACT_BANDS) {
    if (weight >= b.min) chosen = b;
  }
  return chosen;
}

// Same "raw value for logic, translated label for display" split as
// BAND_LABEL_TRANSLATIONS above - impactBand(weight).label itself stays
// English (nothing currently keys off it the way score bands are used as
// filter values, but keeping the pattern consistent costs nothing).
const IMPACT_LABEL_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Very low": { es: "Muy bajo", fr: "Très faible" },
  Low: { es: "Bajo", fr: "Faible" },
  Moderate: { es: "Moderado", fr: "Modéré" },
  High: { es: "Alto", fr: "Élevé" },
  "Very high": { es: "Muy alto", fr: "Très élevé" },
};

/** "Very low" - see IMPACT_BANDS for why this replaces the raw weight in the UI. Defaults to "en" - PDF export (lib/report/policyReportModel.ts) calls this with no language and stays English. */
export function impactLabel(weight: number, language = "en"): string {
  const label = impactBand(weight).label;
  return IMPACT_LABEL_TRANSLATIONS[label]?.[language] ?? label;
}
