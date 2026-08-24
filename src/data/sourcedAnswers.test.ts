import { describe, expect, it } from "vitest";

import seed from "./protocol.seed.json";
import handWritten from "./sourced-answers.json";
import indicators from "./indicator-answers.json";
import { sourcedResponses } from "./sourcedAnswers";
import { childrenOf, isSubdivided, resolveTargets } from "../lib/jurisdictions";
import type { Protocol } from "../lib/types";

const protocol = seed as unknown as Protocol;
const responses = sourcedResponses(protocol.questions);
const QUALITY_VALUES = new Set(["primary-official", "secondary"]);

function find(code: string, row: number) {
  const q = protocol.questions.find((x) => x.sourceRow === row);
  return responses.find((r) => r.countryCode === code && r.questionId === q?.id);
}

describe("jurisdiction resolution", () => {
  it("never emits an answer for a subdivided country itself", () => {
    // Australia has no shape on the map, so an "AU" response could never be
    // displayed or clicked.
    expect(isSubdivided("AU")).toBe(true);
    expect(responses.some((r) => r.countryCode === "AU")).toBe(false);
  });

  it("pushes a federal answer down to every state", () => {
    const states = childrenOf("AU");
    expect(states).toHaveLength(8);
    // Row 54, import duty, is a Commonwealth matter.
    for (const state of states) {
      expect(find(state, 54)?.score).toBe(2);
    }
  });

  it("marks inherited answers as inherited in the note", () => {
    expect(find("AU-TAS", 54)?.evidence[0]?.note).toContain("Inherited from the AU answer");
  });

  it("keeps France's exclaves from inheriting its EU answers", () => {
    // France has children (its overseas exclaves) but keeps its own mappable
    // shape, unlike Australia which has none. A country with children is not
    // automatically "subdivided" - only one with no shape of its own is.
    expect(childrenOf("FR")).toEqual(
      expect.arrayContaining(["FR-GF", "FR-GP", "FR-MQ", "FR-RE", "FR-YT"]),
    );
    expect(isSubdivided("FR")).toBe(false);
    expect(resolveTargets("FR")).toEqual(["FR"]);

    // An EU27-group answer written against "FR" must land on France itself,
    // not on French Guiana, which is not on the European synchronous grid.
    expect(find("FR", 51)).toBeDefined();
    expect(find("FR-GF", 51)).toBeUndefined();
  });

  it("confines NEM market rules to NEM states", () => {
    // Row 26, the eight FCAS markets, is a National Electricity Market rule.
    expect(find("AU-VIC", 26)?.score).toBe(2);
    expect(find("AU-WA", 26)).toBeUndefined();
    expect(find("AU-NT", 26)).toBeUndefined();
  });

  it("lets a state answer override the federal one", () => {
    // Row 47: SA runs past 70% behind-the-meter supply; Australia as a whole
    // does not.
    expect(find("AU-SA", 47)?.score).toBe(2);
    expect(find("AU-VIC", 47)?.score).toBe(1);
    expect(find("AU-SA", 47)?.evidence[0]?.note).not.toContain("Inherited");
  });

  it("pushes US federal answers to every state and insular territory", () => {
    // 50 states + DC + Puerto Rico, Guam and American Samoa. A federal
    // answer inherited this way is a simplification for the territories in
    // particular - insular areas often have their own tax and customs
    // treatment distinct from the mainland (Puerto Rico's own tax system,
    // for one), so an inherited federal score there is a starting
    // assumption to verify with a territory-specific source, not a
    // guarantee, the same caveat any inherited (as opposed to
    // directly-researched) answer carries.
    expect(childrenOf("US")).toHaveLength(54);
    // Row 55: the 25D residential credit was terminated after 2025.
    expect(find("US-TX", 55)?.score).toBe(0);
    expect(find("US-CA", 55)?.score).toBe(0);
  });

  it("lets a state answer a question the federal layer does not", () => {
    // Row 42, hosting capacity maps, is mandated in only seven states. Those
    // carry an exact answer of 2; every other state inherits the federal 0.
    expect(find("US-CA", 42)?.score).toBe(2);
    expect(find("US-NY", 42)?.score).toBe(2);
    expect(find("US-NJ", 42)?.score).toBe(2);
    expect(find("US-TX", 42)?.score).toBe(0);
    expect(find("US-OH", 42)?.score).toBe(0);
    expect(find("US-OH", 42)?.evidence[0]?.note).toContain("Inherited from the US answer");
    // Row 17 is Californian only, so a state without one has no answer at all.
    expect(find("US-OH", 17)).toBeUndefined();
    // Row 41 is Californian only, and must not read as inherited.
    expect(find("US-CA", 41)?.evidence[0]?.note).not.toContain("Inherited");
  });

  it("emits one answer per jurisdiction and question", () => {
    const seen = new Set<string>();
    for (const r of responses) {
      const key = `${r.countryCode}:${r.questionId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("prefers researched national evidence over a statistical proxy", () => {
    // Row 12 is answered for every country by the World Bank lending-rate
    // indicator. Where a hand-written national answer exists it must win, and
    // where none does the proxy must still be present.
    const proxied = responses.filter((r) => r.basis === "proxy-indicator");
    expect(proxied.length).toBeGreaterThan(100);
    expect(proxied.every((r) => r.evidence[0]?.source.includes("worldbank"))).toBe(true);

    for (const r of proxied) {
      const better = responses.find(
        (o) =>
          o.countryCode === r.countryCode &&
          o.questionId === r.questionId &&
          o.basis !== "proxy-indicator",
      );
      expect(better).toBeUndefined();
    }
  });

  it("cites a source on every answer", () => {
    expect(responses.every((r) => r.evidence[0]?.source.includes("http"))).toBe(true);
  });

  it("only uses scores that exist in the question's rubric", () => {
    const byId = new Map(protocol.questions.map((q) => [q.id, q]));
    for (const r of responses) {
      const rubric = byId.get(r.questionId)!.rubric;
      expect(rubric.some((t) => t.score === r.score)).toBe(true);
    }
  });

  // `quality` is optional and not backfilled onto sources added before the
  // field existed (see the long comment on SourceRef in sourcedAnswers.ts) -
  // this only checks that wherever it IS set, it is one of the two values the
  // rest of the app can rely on, not that every source has one.
  it("only uses recognised values for a source's evidence quality", () => {
    const allSources = { ...indicators.sources, ...handWritten.sources };
    for (const [id, source] of Object.entries(allSources)) {
      const quality = (source as { quality?: string }).quality;
      if (quality !== undefined) {
        expect(QUALITY_VALUES.has(quality), `source ${id} has an unrecognised quality value`).toBe(
          true,
        );
      }
    }
  });
});
