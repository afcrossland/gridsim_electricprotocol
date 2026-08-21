import { beforeEach, describe, expect, it } from "vitest";

import { useProtocolStore } from "./protocolStore";

const STORAGE_KEY = "electric-protocol-policy-map";

/**
 * Seeded answers must never be written to storage.
 *
 * Persisting derived data is what made newly researched jurisdictions fail to
 * appear: a cached copy of the old seed shadowed the new one until the store
 * version happened to be bumped. These tests fix the contract so that adding
 * data to the JSON files is enough on its own.
 */
describe("persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    useProtocolStore.getState().resetToSeed();
  });

  it("keeps seeded answers out of localStorage", () => {
    // Trigger a write.
    useProtocolStore.getState().setRole("admin");

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();

    const stored = JSON.parse(raw!).state as { responses: { seeded?: boolean }[] };
    expect(stored.responses.every((r) => !r.seeded)).toBe(true);
    expect(stored.responses).toHaveLength(0);
  });

  it("persists an answer the user actually gives", () => {
    const question = useProtocolStore.getState().questions[0];
    useProtocolStore.getState().setResponse("LK", question.id, { score: 1 });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state as {
      responses: { countryCode: string; questionId: string }[];
    };
    expect(stored.responses).toHaveLength(1);
    expect(stored.responses[0]).toMatchObject({
      countryCode: "LK",
      questionId: question.id,
    });
  });

  it("loads seeded answers for jurisdictions from the data files", () => {
    const { responses } = useProtocolStore.getState();
    const codes = new Set(responses.map((r) => r.countryCode));

    // One from each research tranche, so a dropped data file is caught here
    // rather than by noticing a blank region on the map.
    for (const code of ["GB", "NZ", "DE", "AU-SA", "US-CA", "US-NY", "IN", "LK"]) {
      expect(codes.has(code)).toBe(true);
    }
  });
});
