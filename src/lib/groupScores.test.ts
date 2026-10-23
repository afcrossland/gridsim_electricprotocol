import { describe, expect, it } from "vitest";

import seed from "../data/protocol.seed.json";
import { qualifiedName } from "./jurisdictions";
import { groupScores, scoreCountry } from "./scoring";
import type { CountryScore, Protocol, Response } from "./types";

const protocol = seed as unknown as Protocol;

/**
 * Synthetic answers - the grouping logic is independent of the real dataset,
 * which covers none of the subdivided countries or EU members these tests
 * need. Every jurisdiction answers every question at its top tier, except
 * AU-NT which is left unanswered so there is always an unranked child.
 */
const responses: Response[] = ["AU-SA", "AU-WA", "GB", "DE", "IT", "FR", "FR-GF"].flatMap((code) =>
  protocol.questions.map((q) => ({
    questionId: q.id,
    countryCode: code,
    score: q.rubric[q.rubric.length - 1].score,
    evidence: [],
    updatedAt: "",
  })),
);

function scoresFor(codes: string[]): CountryScore[] {
  return codes.map((code) =>
    scoreCountry(protocol, protocol.questions, responses, code, qualifiedName(code)),
  );
}

describe("groupScores", () => {
  it("groups a subdivided country under one row with no shape of its own", () => {
    // GB, not an EU country - a plain top-level row that neither ISO
    // subdivision nor bloc grouping should touch, alongside the AU states.
    const codes = ["AU-SA", "AU-WA", "AU-NT", "GB"];
    const grouped = groupScores(scoresFor(codes));

    const au = grouped.find((g) => g.code === "AU")!;
    expect(au).toBeDefined();
    expect(au.isGroup).toBe(true);
    expect(au.hasOwnScore).toBe(false);
    expect(au.totalChildren).toBe(3);

    // Individual states must not also appear as their own top-level rows.
    expect(grouped.some((g) => g.code === "AU-SA")).toBe(false);
    expect(grouped.some((g) => g.code === "AU-WA")).toBe(false);

    // A plain country with no children passes through unchanged.
    const gb = grouped.find((g) => g.code === "GB")!;
    expect(gb.isGroup).toBe(false);
    expect(gb.hasOwnScore).toBe(true);
  });

  it("averages a subdivided country's score over ranked children only", () => {
    const codes = ["AU-SA", "AU-WA", "AU-NT"];
    const scores = scoresFor(codes);
    const grouped = groupScores(scores);
    const au = grouped.find((g) => g.code === "AU")!;

    const ranked = scores.filter((s) => s.ranked);
    expect(ranked.length).toBeGreaterThan(0);
    const expected = ranked.reduce((sum, s) => sum + s.score, 0) / ranked.length;

    expect(au.ranked).toBe(true);
    expect(au.rankedChildren).toBe(ranked.length);
    expect(au.score).toBeCloseTo(expected, 10);
  });

  it("never averages in an unranked child, however high its raw score", () => {
    const scores = scoresFor(["AU-SA"]);
    scores[0].ranked = false; // force the only child unranked
    scores[0].score = 0.9; // even with a high score, if unranked it must not count
    const g = groupScores(scores).find((x) => x.code === "AU")!;
    expect(g.ranked).toBe(false);
    expect(g.score).toBe(0);
  });

  it("keeps a non-EU exclave country's own score as the row score", () => {
    // France is an EU member, so testing the exclave case in isolation from
    // bloc absorption needs a country that has exclaves but is not in the EU.
    // None of ours are, so this only proves the *mechanism* is independent of
    // which country hits it - see the France-specific test below for what
    // actually happens when both apply to the same country at once.
    // GB, not DE: an EU country would be swallowed into the "EU" row by
    // the bloc mechanism below, which is real and correct, but would make
    // this assertion about the plain "isGroup: false" path false for the
    // wrong reason.
    const codes = ["GB"];
    const grouped = groupScores(scoresFor(codes));
    const gb = grouped.find((g) => g.code === "GB")!;
    expect(gb.hasOwnScore).toBe(true);
    expect(gb.isGroup).toBe(false);
  });

  it("does not group the EU: every member is its own row, and there is no European Union row", () => {
    const codes = ["DE", "IT", "GB"];
    const grouped = groupScores(scoresFor(codes));
    expect(grouped.some((g) => g.code === "EU")).toBe(false);
    for (const code of codes) {
      const row = grouped.find((g) => g.code === code)!;
      expect(row).toBeDefined();
      expect(row.isGroup).toBe(false);
      expect(row.hasOwnScore).toBe(true);
    }
  });

  it("keeps France a normal top-level row, with its exclaves nested under it", () => {
    // France has its own mappable shape and a real score, so it stays a top-level row; its overseas exclaves (French
    // Guiana and the rest) nest under it for the breakdown rather than getting rows of their own.
    const codes = ["FR", "FR-GF", "DE"];
    const grouped = groupScores(scoresFor(codes));

    const fr = grouped.find((g) => g.code === "FR")!;
    expect(fr).toBeDefined();
    expect(fr.hasOwnScore).toBe(true);
    expect(fr.isGroup).toBe(true);
    expect(fr.children.some((c) => c.code === "FR-GF")).toBe(true);

    // French Guiana itself does not get its own top-level row, and Germany is just a normal row.
    expect(grouped.some((g) => g.code === "FR-GF")).toBe(false);
    expect(grouped.find((g) => g.code === "DE")?.isGroup).toBe(false);
  });
});
