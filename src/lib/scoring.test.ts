import { describe, expect, it } from "vitest";

import seed from "../data/protocol.seed.json";
import { rankImpact, scoreCountry } from "./scoring";
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
      source: "",
      note: "",
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

  it("normalises NZ over answered weight, not total weight", () => {
    const s = scoreCountry(protocol, questions, responses, "NZ", "New Zealand");
    expect(s.answered).toBe(35);
    expect(s.completeness).toBeCloseTo(0.955385, 6);
    // The spreadsheet reports 0.502 for NZ because its four blanks are counted
    // as zeros in the denominator. Dividing by answered weight instead gives a
    // materially higher figure, and is the number the app ranks on.
    expect(s.score).toBeCloseTo(0.464171, 6);
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
        source: "",
        note: "",
        updatedAt: "",
      },
    ];
    const s = scoreCountry(protocol, questions, sparse, "IN", "India");
    // A single perfect answer would otherwise put India top of the board.
    expect(s.score).toBe(1);
    expect(s.completeness).toBeLessThan(protocol.completenessThreshold);
    expect(s.ranked).toBe(false);
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
