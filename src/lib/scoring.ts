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
 * Weighted score normalised over *answered* weight only.
 *
 * The spreadsheet divides by the weight of every question, which scores an
 * unanswered question as if it were a zero and makes a partly-filled country
 * look far worse than it is. Here the denominator is the weight of what has
 * actually been answered, so the number means "of the policy you have told us
 * about, this is how much is in place". Completeness is reported alongside it
 * so a thinly-evidenced score can be read for what it is.
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
    earned += q.weight * r.score;
  }

  const score = answeredWeight > 0 ? earned / (answeredWeight * protocol.maxScore) : 0;
  const completeness = totalWeight > 0 ? answeredWeight / totalWeight : 0;

  return {
    code,
    name,
    score,
    completeness,
    answered,
    total: questions.length,
    ranked: completeness >= (threshold ?? protocol.completenessThreshold),
  };
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
    (sum, q) => sum + q.weight * (byId.get(q.id)?.score ?? 0),
    0,
  );

  const items: ImpactItem[] = [];

  for (const q of questions) {
    const r = byId.get(q.id);
    if (!r) continue; // unanswered: a research gap, not a ranked policy gap

    const currentScore = r.score;
    const gain = q.weight * (protocol.maxScore - currentScore);
    if (gain <= 0) continue;

    const nextEarned = earned + gain;
    const nextScore = answeredWeight > 0 ? nextEarned / (answeredWeight * protocol.maxScore) : 0;

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
 *   record: France is both an EU member (hidden from the top-level list,
 *   shown only inside the EU row) and, everywhere else in the app, still a
 *   fully independent, mappable, directly-clickable country in its own right.
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
  const childrenByBloc = new Map<string, CountryScore[]>();
  for (const [blocCode, bloc] of Object.entries(POLITICAL_BLOCS)) {
    for (const memberCode of bloc.members) {
      const s = byCode.get(memberCode);
      if (!s) continue;
      const list = childrenByBloc.get(blocCode) ?? [];
      list.push(s);
      childrenByBloc.set(blocCode, list);
      hiddenFromTopLevel.add(s.code);
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

/** Colour ramp for the choropleth, low score to high. */
export const SCORE_RAMP = [
  { stop: 0.0, color: "#E24B4A" },
  { stop: 0.25, color: "#EF864C" },
  { stop: 0.5, color: "#FBB114" },
  { stop: 0.75, color: "#5FCCD8" },
  { stop: 1.0, color: "#008194" },
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
