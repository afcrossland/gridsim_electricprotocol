import { describe, expect, it, vi } from "vitest";

// The resolution logic is tested against a small fixture, not the shipped
// data, so it keeps working however the real answer files change.
vi.mock("./sourced-answers.json", () => ({
  default: {
    sources: { s1: { title: "Source one", url: "https://example.org/one" } },
    groups: {
      NEM: ["AU-NSW", "AU-QLD", "AU-VIC", "AU-SA", "AU-TAS", "AU-ACT"],
      EU27: ["FR", "DE"],
    },
    answers: [
      { countries: ["AU"], row: 54, score: 2, basis: "national", sourceId: "s1", note: "Federal duty rule" },
      { group: "NEM", row: 26, score: 2, basis: "national", sourceId: "s1", note: "NEM rule" },
      { countries: ["AU"], row: 47, score: 1, basis: "national", sourceId: "s1", note: "Australia overall" },
      { countries: ["AU-SA"], row: 47, score: 2, basis: "national", sourceId: "s1", note: "SA specific" },
      { countries: ["US"], row: 55, score: 0, basis: "national", sourceId: "s1", note: "Federal credit" },
      { countries: ["US"], row: 42, score: 0, basis: "national", sourceId: "s1", note: "Federal hosting maps" },
      { countries: ["US-CA", "US-NY", "US-NJ"], row: 42, score: 2, basis: "national", sourceId: "s1", note: "State mandate" },
      { countries: ["US-CA"], row: 17, score: 1, basis: "national", sourceId: "s1", note: "California only" },
      { group: "EU27", row: 51, score: 1, basis: "directive-baseline", sourceId: "s1", note: "EU rule" },
      { countries: ["DE"], row: 12, score: 2, basis: "national", sourceId: "s1", note: "Researched" },
    ],
  },
}));
vi.mock("./indicator-answers.json", () => ({
  default: {
    sources: { p1: { title: "Proxy", url: "https://example.org/proxy" } },
    groups: {},
    answers: [
      { countries: ["DE"], row: 12, score: 0, basis: "proxy-indicator", sourceId: "p1", note: "Proxy" },
      { countries: ["NL"], row: 12, score: 1, basis: "proxy-indicator", sourceId: "p1", note: "Proxy" },
    ],
  },
}));

import seed from "./protocol.seed.json";
import { sourcedResponses } from "./sourcedAnswers";
import { childrenOf, isSubdivided, resolveTargets } from "../lib/jurisdictions";
import type { Protocol } from "../lib/types";

const protocol = seed as unknown as Protocol;
const responses = sourcedResponses(protocol.questions);

function find(code: string, row: number) {
  const q = protocol.questions.find((x) => x.sourceRow === row);
  return responses.find((r) => r.countryCode === code && r.questionId === q?.id);
}

describe("jurisdiction resolution", () => {
  it("never emits an answer for a subdivided country itself", () => {
    // Australia has no shape on the map, so an "AU" response could never be displayed or clicked.
    expect(isSubdivided("AU")).toBe(true);
    expect(responses.some((r) => r.countryCode === "AU")).toBe(false);
  });

  it("pushes a federal answer down to every state", () => {
    const states = childrenOf("AU");
    expect(states).toHaveLength(8);
    for (const state of states) expect(find(state, 54)?.score).toBe(2);
  });

  it("marks inherited answers as inherited in the note", () => {
    expect(find("AU-TAS", 54)?.evidence[0]?.note).toContain("Inherited from the AU answer");
  });

  it("keeps France's exclaves from inheriting its EU answers", () => {
    // France keeps its own mappable shape, so a country with children is not automatically "subdivided".
    expect(childrenOf("FR")).toEqual(expect.arrayContaining(["FR-GF", "FR-GP", "FR-MQ", "FR-RE", "FR-YT"]));
    expect(isSubdivided("FR")).toBe(false);
    expect(resolveTargets("FR")).toEqual(["FR"]);
    expect(find("FR", 51)).toBeDefined();
    expect(find("FR-GF", 51)).toBeUndefined();
  });

  it("confines NEM market rules to NEM states", () => {
    expect(find("AU-VIC", 26)?.score).toBe(2);
    expect(find("AU-WA", 26)).toBeUndefined();
    expect(find("AU-NT", 26)).toBeUndefined();
  });

  it("lets a state answer override the federal one", () => {
    expect(find("AU-SA", 47)?.score).toBe(2);
    expect(find("AU-VIC", 47)?.score).toBe(1);
    expect(find("AU-SA", 47)?.evidence[0]?.note).not.toContain("Inherited");
  });

  it("pushes US federal answers to every state and insular territory", () => {
    expect(childrenOf("US")).toHaveLength(54);
    expect(find("US-TX", 55)?.score).toBe(0);
    expect(find("US-CA", 55)?.score).toBe(0);
  });

  it("lets a state answer a question the federal layer does not", () => {
    expect(find("US-CA", 42)?.score).toBe(2);
    expect(find("US-NY", 42)?.score).toBe(2);
    expect(find("US-TX", 42)?.score).toBe(0);
    expect(find("US-OH", 42)?.evidence[0]?.note).toContain("Inherited from the US answer");
    // Row 17 is California-only, so a state without one has no answer at all.
    expect(find("US-OH", 17)).toBeUndefined();
    expect(find("US-CA", 17)?.evidence[0]?.note).not.toContain("Inherited");
  });

  it("prefers researched national evidence over a statistical proxy", () => {
    expect(find("DE", 12)?.basis).toBe("national");
    expect(find("DE", 12)?.score).toBe(2);
    // Where there is no researched answer the proxy still applies.
    expect(find("NL", 12)?.basis).toBe("proxy-indicator");
  });
});
