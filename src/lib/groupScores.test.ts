import { describe, expect, it } from "vitest";

import seed from "../data/protocol.seed.json";
import { sourcedResponses } from "../data/sourcedAnswers";
import { qualifiedName } from "./jurisdictions";
import { groupScores, scoreCountry } from "./scoring";
import type { CountryScore, Protocol } from "./types";

const protocol = seed as unknown as Protocol;
const responses = sourcedResponses(protocol.questions);

function scoresFor(codes: string[]): CountryScore[] {
  return codes.map((code) =>
    scoreCountry(protocol, protocol.questions, responses, code, qualifiedName(code)),
  );
}

describe("groupScores", () => {
  it("groups a subdivided country under one row with no shape of its own", () => {
    const codes = ["AU-SA", "AU-WA", "AU-NT", "DE"];
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
    const de = grouped.find((g) => g.code === "DE")!;
    expect(de.isGroup).toBe(false);
    expect(de.hasOwnScore).toBe(true);
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

  it("keeps France's own score as the row score and lists exclaves separately", () => {
    const codes = ["FR", "FR-GF", "FR-GP"];
    const grouped = groupScores(scoresFor(codes));
    const fr = grouped.find((g) => g.code === "FR")!;

    const plainFr = scoreCountry(protocol, protocol.questions, responses, "FR", "France");
    expect(fr.hasOwnScore).toBe(true);
    expect(fr.isGroup).toBe(true);
    expect(fr.score).toBeCloseTo(plainFr.score, 10);
    expect(fr.totalChildren).toBe(2);

    // Exclaves must not appear as their own top-level rows either.
    expect(grouped.some((g) => g.code === "FR-GF")).toBe(false);
  });
});
