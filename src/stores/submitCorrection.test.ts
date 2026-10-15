import { describe, expect, it } from "vitest";
import { useProtocolStore } from "./protocolStore";

describe("submitCorrection", () => {
  it("files a pending suggestion without changing the live answer until accepted", () => {
    const store = useProtocolStore;
    const gb = store.getState().responses.filter((r) => r.countryCode === "GB");
    const target = gb.find((r) => r.score === 2)!;
    const before = target.score;

    store.getState().submitCorrection({
      countryCode: "GB",
      countryName: "Great Britain",
      questionId: target.questionId,
      proposedScore: 0,
      source: "https://example.org/evidence",
      reason: "Rule was repealed",
      submitterName: "Test Person",
      submitterOrganisation: "",
    });

    const live = () => store.getState().responses.find((r) => r.countryCode === "GB" && r.questionId === target.questionId)!;
    const suggestion = store.getState().suggestions.at(-1)!;
    expect(suggestion.status).toBe("pending");
    expect(suggestion.submitterName).toBe("Test Person");
    expect(suggestion.changes.some((c) => c.kind === "score")).toBe(true);
    expect(live().score).toBe(before);

    store.getState().reviewSuggestion(suggestion.id, "accepted");
    expect(live().score).toBe(0);
    expect(live().evidence.at(-1)?.source).toBe("https://example.org/evidence");
  });
});
