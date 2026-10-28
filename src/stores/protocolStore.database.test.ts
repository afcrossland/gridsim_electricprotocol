import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import seedJson from "../data/protocol.seed.json";
import sourcedJson from "../data/sourced-answers.json";
import indicatorJson from "../data/indicator-answers.json";
import jurisdictionsJson from "../data/jurisdictions.json";

const STORAGE_KEY = "electric-protocol-policy-map";
const firstQuestion = seedJson.questions[0];
const firstAnswer = sourcedJson.answers.find((a) => a.row === firstQuestion.sourceRow)!;
const answeredCountry = firstAnswer.countries![0];

/**
 * The store as a database build sees it (ROADMAP.md Phase 4): data loaded
 * from /api/policy/data, the browser's own saved edits ignored.
 */
async function storeLoadedFromDatabase(editedResponses: unknown[]) {
  vi.resetModules();
  const { loadPolicyData } = await import("../data/policyData");
  const body = {
    protocol: { ...seedJson, questions: [{ ...firstQuestion, text: "From the database" }, ...seedJson.questions.slice(1)] },
    jurisdictions: jurisdictionsJson,
    sourced: sourcedJson,
    indicator: indicatorJson,
    responses: editedResponses,
  };
  const fetchImpl = (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  expect(await loadPolicyData({ fetchImpl })).toBe("api");
  return (await import("./protocolStore")).useProtocolStore;
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("database builds", () => {
  it("apply editors' answers over researched ones, and hide cleared ones", async () => {
    const useStore = await storeLoadedFromDatabase([
      { countryCode: "DE", questionId: firstQuestion.id, score: 0, basis: null, evidence: [{ title: "t", source: "s", note: "n" }], updatedAt: "2026-10-21T00:00:00Z", updatedBy: "ed@example.org" },
      { countryCode: answeredCountry, questionId: firstQuestion.id, score: null, basis: null, evidence: [], updatedAt: "2026-10-21T00:00:00Z", updatedBy: "ed@example.org" },
    ]);
    const responses = useStore.getState().responses;
    const de = responses.find((r) => r.countryCode === "DE" && r.questionId === firstQuestion.id);
    expect(de).toMatchObject({ score: 0, evidence: [{ title: "t", source: "s", note: "n" }] });
    expect(responses.find((r) => r.countryCode === answeredCountry && r.questionId === firstQuestion.id)).toBeUndefined();
  });

  it("ignore edits this browser saved before, and don't save data here", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 11,
        state: {
          threshold: 0.9,
          mode: "dark",
          questionOverrides: { [firstQuestion.id]: { text: "Old local edit" } },
          responses: [{ countryCode: "FR", questionId: firstQuestion.id, score: 2, evidence: [], updatedAt: "x" }],
          suggestions: [],
          questionProposals: [],
        },
      }),
    );
    const useStore = await storeLoadedFromDatabase([]);
    const state = useStore.getState();
    expect(state.questions.find((q) => q.id === firstQuestion.id)?.text).toBe("From the database");
    expect(state.threshold).toBe(seedJson.completenessThreshold);
    expect(state.responses.find((r) => r.countryCode === "FR" && r.questionId === firstQuestion.id && r.score === 2 && !r.seeded)).toBeUndefined();
    expect(state.mode).toBe("dark"); // preferences still carry over

    state.setMapMetric("completeness"); // trigger a save
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state;
    expect(Object.keys(stored).sort()).toEqual(["language", "mapMetric", "mode", "questionProposals", "suggestions", "tourSeen", "welcomeSeen"]);
  });

  it("hand corrections and proposals back for the server instead of keeping them here", async () => {
    const useStore = await storeLoadedFromDatabase([]);
    const correction = useStore.getState().submitCorrection({
      countryCode: answeredCountry,
      countryName: "Somewhere",
      questionId: firstQuestion.id,
      proposedScore: firstQuestion.rubric[0].score === firstAnswer.score ? firstQuestion.rubric[1].score : firstQuestion.rubric[0].score,
      source: "https://example.org",
      reason: "It changed",
      submitterName: "Ada",
      submitterOrganisation: "",
    });
    expect(correction?.status).toBe("pending");
    const proposal = useStore.getState().submitQuestionProposal({
      sectionId: seedJson.sections[0].id,
      sectionTitle: seedJson.sections[0].title,
      text: "New?",
      strongLabel: "Yes",
      developedLabel: "",
      weakLabel: "No",
      reason: "",
      source: "",
      submitterName: "Bo",
      submitterOrganisation: "",
    });
    expect(proposal.status).toBe("pending");
    expect(useStore.getState().suggestions).toEqual([]);
    expect(useStore.getState().questionProposals).toEqual([]);
  });
});
