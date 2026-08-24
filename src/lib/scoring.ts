import { EU27 } from "../data/sourcedAnswers";
import { getJurisdiction } from "./jurisdictions";
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
 * Political/economic blocs collapsed into one scoreboard row, the same way a
 * subdivided country's states roll up - distinct from ISO subdivision
 * (Australia, the US, Canada) because every member keeps its own real
 * jurisdiction record, shape and score everywhere else (the map, search, its
 * own country page). This only changes how the *scoreboard* reads 27
 * near-identical rows as one. Extend this map for another bloc row.
 */
const POLITICAL_BLOCS: Record<string, { name: string; members: readonly string[] }> = {
  EU: { name: "European Union", members: EU27 },
};

/**
 * Ceiling a rubric tier's `points` can be set to in the admin console, and
 * what `scoreCountry` and `rankImpact` normalise a question against - fixed
 * globally rather than per question, so a question whose tiers are all set
 * below 4 simply cannot contribute its full share, by admin choice. This is
 * the scoring ceiling now, not `protocol.maxScore` (which stays 2, the count
 * of rubric steps above zero - a display concern, not a scoring one).
 */
const MAX_TIER_POINTS = 4;

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
 * Group country scores for the scoreboard - by sovereign state, and by
 * political bloc where one is configured (POLITICAL_BLOCS, currently the EU).
 *
 * Three different shapes of row come out of this:
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
 * - A bloc (the EU) has no jurisdiction of its own at all - not a country, not
 *   a subdivision - so it is built purely from its members' scores, using the
 *   same ranked-only averaging as a subdivided country. Unlike ISO
 *   subdivision, membership does not touch a country's own jurisdiction
 *   record: an ordinary EU member (Germany, say) is hidden from the top-level
 *   list and shown only inside the EU row, but a member that is itself a
 *   France-shaped country (its own mappable shape, plus exclave children of
 *   its own) stays a normal top-level row too - see the comment where
 *   `childrenByBloc` is built for why.
 */
export function groupScores(scores: CountryScore[]): GroupedScore[] {
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

  // Political blocs: member states roll up under the bloc the same way,
  // without touching their own jurisdiction record - each still has a real
  // ISO parent of null (a top-level sovereign country) everywhere else.
  //
  // A member with its own exclave children (France) is the one exception -
  // it still contributes to the bloc's average below, but is not hidden from
  // the top level. Hiding it there would have meant its own exclaves
  // (French Guiana etc.) had nowhere left to nest under: `children` is only
  // ever attached to a row that is actually pushed to `grouped`, and a
  // country demoted to a bare bloc-member entry never gets one. France needs
  // to stay a normal, independent top-level row - with its exclaves nested
  // under it, same as if it were not in any bloc at all - for exactly the
  // reason it is not ISO-subdivided in the first place.
  const childrenByBloc = new Map<string, CountryScore[]>();
  for (const [blocCode, bloc] of Object.entries(POLITICAL_BLOCS)) {
    for (const memberCode of bloc.members) {
      const s = byCode.get(memberCode);
      if (!s) continue;
      const list = childrenByBloc.get(blocCode) ?? [];
      list.push(s);
      childrenByBloc.set(blocCode, list);
      if (!childrenByParent.has(s.code)) hiddenFromTopLevel.add(s.code);
    }
  }

  const grouped: GroupedScore[] = [];

  for (const s of scores) {
    if (hiddenFromTopLevel.has(s.code)) continue; // shown under its parent/bloc below
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
    grouped.push(syntheticGroup(parentCode, getJurisdiction(parentCode)?.name ?? parentCode, children));
  }

  // Blocs have no jurisdiction entry at all, so this is the only place they
  // are ever produced.
  for (const [blocCode, bloc] of Object.entries(POLITICAL_BLOCS)) {
    const children = childrenByBloc.get(blocCode);
    if (children && children.length > 0) grouped.push(syntheticGroup(blocCode, bloc.name, children));
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
 * Colour ramp for the choropleth, low score to high - red to green, drawn
 * from the sibling gridsim-frontend project's own carbon-intensity scale
 * (`CARBON_COLOUR_STOPS`), reversed (there low is good/green, high is bad/
 * red; here a high score is good) and without its darkest, near-black red -
 * too harsh at this end of the scale - so the lowest stop is its ordinary
 * red instead, with an extra orange step added between that and the amber
 * stop so the ramp still reads as five distinct, evenly-spaced colours.
 */
export const SCORE_RAMP = [
  { stop: 0.0, color: "#c0392b" },
  { stop: 0.25, color: "#f47c2c" },
  { stop: 0.5, color: "#f9a825" },
  { stop: 0.75, color: "#c8e07b" },
  { stop: 1.0, color: "#1a9850" },
] as const;

/** Countries below the completeness threshold, and those with no data at all. */
export const COLOR_INSUFFICIENT = "#D1D5DB";
export const COLOR_NO_DATA = "#EDEBE4";

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
  { label: "Very ineffective", min: 0.0, color: "#c0392b" },
  { label: "Ineffective", min: 0.2, color: "#f47c2c" },
  { label: "Moderate", min: 0.4, color: "#f9a825" },
  { label: "Effective", min: 0.6, color: "#c8e07b" },
  { label: "Very effective", min: 0.8, color: "#1a9850" },
] as const;

export function scoreBand(score: number): (typeof SCORE_BANDS)[number] {
  let chosen: (typeof SCORE_BANDS)[number] = SCORE_BANDS[0];
  for (const b of SCORE_BANDS) {
    if (score >= b.min) chosen = b;
  }
  return chosen;
}

/** "Good (75%)" - the band leads so a reader isn't left comparing two raw numbers, the percentage follows for anyone who wants the detail. */
export function scoreLabel(score: number): string {
  return `${scoreBand(score).label} (${Math.round(score * 100)}%)`;
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

/** "Very low" - see IMPACT_BANDS for why this replaces the raw weight in the UI. */
export function impactLabel(weight: number): string {
  return impactBand(weight).label;
}
