import type {
  CountryScore,
  ImpactItem,
  Protocol,
  Question,
  Response,
  Section,
} from "./types";

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
