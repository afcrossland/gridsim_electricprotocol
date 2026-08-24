import { describe, expect, it } from "vitest";

import seed from "../data/protocol.seed.json";
import { rankImpact, scoreCountry, scoreSections } from "./scoring";
import type { Protocol, Response } from "./types";

const protocol = seed as unknown as Protocol;
const { questions, sections } = protocol;

/** Spreadsheet seed answers, in the shape the app stores them. */
function seedResponses(): Response[] {
  return questions.flatMap((q) =>
    Object.entries(q.seedAnswers ?? {}).map(([countryCode, score]) => ({
      questionId: q.id,
      countryCode,
      score,
      evidence: [],
      updatedAt: "1970-01-01T00:00:00.000Z",
    })),
  );
}

describe("scoreCountry", () => {
  const responses = seedResponses();

  it("scores GB over its full set of answers", () => {
    const s = scoreCountry(protocol, questions, responses, "GB", "Great Britain");
    expect(s.answered).toBe(39);
    expect(s.completeness).toBe(1);
    expect(s.score).toBeCloseTo(0.623462, 6);
    expect(s.ranked).toBe(true);
  });

  it("normalises NZ over answered weight, not total weight, then discounts by completeness", () => {
    const s = scoreCountry(protocol, questions, responses, "NZ", "New Zealand");
    expect(s.answered).toBe(35);
    expect(s.completeness).toBeCloseTo(0.955385, 6);
    // The spreadsheet reports 0.502 for NZ because its four blanks are counted
    // as zeros in the denominator. Dividing by answered weight instead gives a
    // materially higher raw rate (0.464171), and the completeness discount
    // below then pulls that back down slightly for the four still-unanswered.
    expect(s.score).toBeCloseTo(0.443462, 6);
  });

  it("discounts a thinly-but-perfectly-answered country below one with broader, more mixed coverage", () => {
    // Answer only the heaviest questions (weight >= 3, ~37% of total weight)
    // for LK, all at full marks - clears the completeness threshold on
    // weight alone without touching most of the protocol.
    const heavy = questions.filter((q) => q.weight >= 3);
    const cherryPicked: Response[] = heavy.map((q) => ({
      questionId: q.id,
      countryCode: "LK",
      score: q.rubric[q.rubric.length - 1].score,
      evidence: [],
      updatedAt: "",
    }));
    const thin = scoreCountry(protocol, questions, cherryPicked, "LK", "Sri Lanka");
    expect(thin.ranked).toBe(true);

    // A perfect raw achievement rate on what was answered...
    const heavyWeight = heavy.reduce((sum, q) => sum + q.weight, 0);
    const totalWeight = questions.reduce((sum, q) => sum + q.weight, 0);
    expect(thin.completeness).toBeCloseTo(heavyWeight / totalWeight, 10);

    // ...is discounted well below 100%, not shown at face value.
    expect(thin.score).toBeCloseTo(thin.completeness, 10);
    expect(thin.score).toBeLessThan(1);

    // GB answers everything, including plenty of lower marks - broader,
    // messier coverage still outranks the thin-but-perfect country.
    const gb = scoreCountry(protocol, questions, responses, "GB", "Great Britain");
    expect(gb.score).toBeGreaterThan(thin.score);
  });

  it("returns a zero score, not NaN, for a country with no answers", () => {
    const s = scoreCountry(protocol, questions, responses, "LK", "Sri Lanka");
    expect(s.score).toBe(0);
    expect(s.completeness).toBe(0);
    expect(s.ranked).toBe(false);
  });

  it("withholds ranking below the completeness threshold", () => {
    const sparse: Response[] = [
      {
        questionId: questions[0].id,
        countryCode: "IN",
        score: 2,
        evidence: [],
        updatedAt: "",
      },
    ];
    const s = scoreCountry(protocol, questions, sparse, "IN", "India");
    // A single perfect answer is only 1 of 39 questions' weight, so even
    // before the completeness discount this cannot put India top of the
    // board - and the discount means the raw 100% achievement rate on that
    // one answer is not what gets shown either: score equals completeness
    // itself, since a perfect rawScore of 1 leaves the discount as the only
    // remaining factor.
    expect(s.score).toBeCloseTo(s.completeness, 10);
    expect(s.completeness).toBeLessThan(protocol.completenessThreshold);
    expect(s.ranked).toBe(false);
  });
});

describe("scoreSections", () => {
  const responses = seedResponses();

  it("covers every section, and each section's own question set only", () => {
    const breakdown = scoreSections(protocol, sections, questions, responses, "GB");
    expect(breakdown).toHaveLength(sections.length);

    for (const { section, score } of breakdown) {
      const inSection = questions.filter((q) => q.sectionId === section.id);
      expect(score.total).toBe(inSection.length);
      expect(score.answered).toBeLessThanOrEqual(inSection.length);
    }
  });

  it("partitions the full question set - every question counted in exactly one section", () => {
    // Sections are non-overlapping, so summing each section's own total/
    // answered counts (each computed by the same scoreCountry() this test
    // compares against) must reconstruct the whole-protocol figures exactly.
    const breakdown = scoreSections(protocol, sections, questions, responses, "GB");
    const whole = scoreCountry(protocol, questions, responses, "GB", "Great Britain");

    const totalAcrossSections = breakdown.reduce((sum, b) => sum + b.score.total, 0);
    const answeredAcrossSections = breakdown.reduce((sum, b) => sum + b.score.answered, 0);
    expect(totalAcrossSections).toBe(questions.length);
    expect(totalAcrossSections).toBe(whole.total);
    expect(answeredAcrossSections).toBe(whole.answered);
  });

  it("marks a section unranked when it falls below the completeness threshold on its own", () => {
    const sparse: Response[] = [
      {
        questionId: questions[0].id, // row 10, in the first section
        countryCode: "IN",
        score: 2,
        evidence: [],
        updatedAt: "",
      },
    ];
    const breakdown = scoreSections(protocol, sections, questions, sparse, "IN");
    const untouched = breakdown.find((b) => b.section.id !== questions[0].sectionId);
    expect(untouched?.score.answered).toBe(0);
    expect(untouched?.score.ranked).toBe(false);
  });
});

describe("rankImpact", () => {
  const responses = seedResponses();

  it("ranks by weighted points available and excludes full marks", () => {
    const items = rankImpact(protocol, questions, sections, responses, "GB");
    const atFullMarks = questions.filter((q) => q.seedAnswers?.GB === 2).length;

    expect(items).toHaveLength(questions.length - atFullMarks);
    expect(items.every((i) => i.gain > 0)).toBe(true);

    const gains = items.map((i) => i.gain);
    expect(gains).toEqual([...gains].sort((a, b) => b - a));
  });

  it("gives a zero-scored heavy question more impact than a partial light one", () => {
    const items = rankImpact(protocol, questions, sections, responses, "GB");
    const top = items[0];
    // Tier points: 0 -> 0, 1 -> 1, 2 -> 4 (a top-tier answer counts double a
    // linear scale would), normalised against a ceiling of 4.
    const tierPoints = [0, 1, 4][top.currentScore];
    expect(top.gain).toBe(top.question.weight * (4 - tierPoints));
  });

  it("excludes unanswered questions - this list is confirmed gaps, not unknowns", () => {
    const items = rankImpact(protocol, questions, sections, responses, "NZ");
    const answeredIds = new Set(
      responses.filter((r) => r.countryCode === "NZ").map((r) => r.questionId),
    );

    // NZ has 4 unanswered questions in the seed data; none should appear here.
    expect(questions.length - answeredIds.size).toBe(4);
    expect(items.every((i) => answeredIds.has(i.question.id))).toBe(true);
    expect(items.every((i) => typeof i.currentScore === "number")).toBe(true);
  });
});
