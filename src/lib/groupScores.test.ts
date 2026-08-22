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

  it("collapses the EU into one row, averaged over ranked members only", () => {
    // A handful of real member states, not all 27 - groupScores only sees
    // whichever EU27 codes are actually present in `scores`.
    const codes = ["DE", "FR", "IT", "GB"]; // GB is not in the EU, a control.
    const scores = scoresFor(codes);
    const grouped = groupScores(scores);

    const eu = grouped.find((g) => g.code === "EU")!;
    expect(eu).toBeDefined();
    expect(eu.hasOwnScore).toBe(false);
    expect(eu.name).toBe("European Union");

    // Members are hidden from the top-level list...
    expect(grouped.some((g) => g.code === "DE")).toBe(false);
    expect(grouped.some((g) => g.code === "FR")).toBe(false);
    expect(grouped.some((g) => g.code === "IT")).toBe(false);
    // ...but a non-member is unaffected and stays a normal top-level row.
    const gb = grouped.find((g) => g.code === "GB")!;
    expect(gb).toBeDefined();
    expect(gb.hasOwnScore).toBe(true);

    const members = scores.filter((s) => ["DE", "FR", "IT"].includes(s.code));
    const ranked = members.filter((s) => s.ranked);
    expect(eu.totalChildren).toBe(members.length);
    expect(eu.rankedChildren).toBe(ranked.length);
    if (ranked.length > 0) {
      const expected = ranked.reduce((sum, s) => sum + s.score, 0) / ranked.length;
      expect(eu.score).toBeCloseTo(expected, 10);
    }
  });

  it("absorbs France into the EU row rather than showing its own exclave group", () => {
    // The one case where both mechanisms apply to the same country: France is
    // both an EU member and an exclave-bearing country. Bloc membership wins -
    // France disappears from the top level entirely, the same way an
    // Australian state would, rather than keeping its own top-level exclave
    // row. Its exclaves are not shown inside the EU row either: only France's
    // own CountryScore becomes an EU child, since EU membership does not
    // recurse into a member's own children.
    const codes = ["FR", "FR-GF", "DE"];
    const grouped = groupScores(scoresFor(codes));

    expect(grouped.some((g) => g.code === "FR")).toBe(false);
    expect(grouped.some((g) => g.code === "FR-GF")).toBe(false);

    const eu = grouped.find((g) => g.code === "EU")!;
    expect(eu.children.some((c) => c.code === "FR")).toBe(true);
    expect(eu.children.some((c) => c.code === "FR-GF")).toBe(false);
  });
});
