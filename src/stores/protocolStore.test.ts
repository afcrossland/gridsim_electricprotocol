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
    useProtocolStore.getState().setThreshold(0.35);

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

  it("keeps sections and the base questions array out of localStorage", () => {
    // Trigger a write.
    useProtocolStore.getState().setThreshold(0.35);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state as Record<
      string,
      unknown
    >;
    expect(stored.sections).toBeUndefined();
    expect(stored.questions).toBeUndefined();
  });

  it("persists an admin edit to a question as a sparse override, and reapplies it on reload", () => {
    const question = useProtocolStore.getState().questions[0];
    useProtocolStore.getState().updateQuestion(question.id, { weight: 9.5 });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state as {
      questionOverrides: Record<string, Partial<{ weight: number }>>;
    };
    expect(stored.questionOverrides[question.id]).toEqual({ weight: 9.5 });

    useProtocolStore.persist.rehydrate();
    const rehydrated = useProtocolStore.getState().questions.find((q) => q.id === question.id);
    expect(rehydrated?.weight).toBe(9.5);
  });

  it("does not let an override mask an unrelated question's shipped text", () => {
    const [first, second] = useProtocolStore.getState().questions;
    useProtocolStore.getState().updateQuestion(first.id, { weight: 9.5 });

    useProtocolStore.persist.rehydrate();
    const rehydratedSecond = useProtocolStore.getState().questions.find((q) => q.id === second.id);
    expect(rehydratedSecond?.text).toBe(second.text);
  });

  it("resetQuestion discards the override and restores the shipped question", () => {
    const question = useProtocolStore.getState().questions[0];
    useProtocolStore.getState().updateQuestion(question.id, { text: "Edited text" });
    useProtocolStore.getState().resetQuestion(question.id);

    const restored = useProtocolStore.getState().questions.find((q) => q.id === question.id);
    expect(restored?.text).toBe(question.text);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state as {
      questionOverrides: Record<string, unknown>;
    };
    expect(stored.questionOverrides[question.id]).toBeUndefined();
  });

  it("persists an added question and section, and reapplies them on reload", () => {
    const sectionId = useProtocolStore.getState().addSection("Training");
    const questionId = useProtocolStore.getState().addQuestion(sectionId);

    useProtocolStore.persist.rehydrate();

    const state = useProtocolStore.getState();
    expect(state.sections.some((s) => s.id === sectionId && s.title === "Training")).toBe(true);
    expect(state.questions.some((q) => q.id === questionId && q.sectionId === sectionId)).toBe(
      true,
    );
  });

  it("deleting a section cascades to its questions and their responses", () => {
    const sectionId = useProtocolStore.getState().addSection("Training");
    const questionId = useProtocolStore.getState().addQuestion(sectionId);
    useProtocolStore.getState().setResponse("LK", questionId, { score: 1 });

    useProtocolStore.getState().deleteSection(sectionId);

    const state = useProtocolStore.getState();
    expect(state.sections.some((s) => s.id === sectionId)).toBe(false);
    expect(state.questions.some((q) => q.id === questionId)).toBe(false);
    expect(state.responses.some((r) => r.questionId === questionId)).toBe(false);

    useProtocolStore.persist.rehydrate();
    expect(useProtocolStore.getState().sections.some((s) => s.id === sectionId)).toBe(false);
  });

  it("deleting a shipped question keeps it out of the live set after reload", () => {
    const question = useProtocolStore.getState().questions[0];
    useProtocolStore.getState().deleteQuestion(question.id);

    useProtocolStore.persist.rehydrate();
    expect(useProtocolStore.getState().questions.some((q) => q.id === question.id)).toBe(false);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!).state as {
      removedQuestionIds: string[];
    };
    expect(stored.removedQuestionIds).toContain(question.id);
  });

  it("never shows stale question text from a cache written before a wording fix shipped", () => {
    // Simulate the actual bug: a browser that persisted state before the
    // CER/CP acronym cleanup shipped, carrying the old wording in `questions`.
    // Even if such a blob still exists in someone's localStorage, the current
    // code must never read `questions`/`sections` back out of it.
    const question = useProtocolStore.getState().questions[0];
    const staleBlob = {
      state: {
        role: "registered",
        threshold: 0.3,
        responses: [],
        sections: useProtocolStore.getState().sections,
        questions: [{ ...question, text: "Old wording with a CER and a CP in it" }],
      },
      version: 7,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(staleBlob));

    useProtocolStore.persist.rehydrate();

    const rehydrated = useProtocolStore.getState().questions.find((q) => q.id === question.id);
    expect(rehydrated?.text).toBe(question.text);
    expect(rehydrated?.text).not.toContain("CER");
    expect(rehydrated?.text).not.toContain("CP");
  });

  it("resetToSeed brings back the scroll-story intro, not just fresh data", () => {
    // Simulate a returning visitor who has already dismissed the tour and
    // the Charter, and wandered into the admin console - exactly the state
    // "Reset everything to seed" is clicked from in practice.
    useProtocolStore.setState({
      tourSeen: true,
      welcomeSeen: true,
      page: "admin",
      selectedCountry: "GB",
    });

    useProtocolStore.getState().resetToSeed();

    const state = useProtocolStore.getState();
    // App.tsx renders <ScrollStory /> whenever tourSeen is false. welcomeSeen
    // must come back *true* (closed) - WelcomeModal opens on `!welcomeSeen`,
    // so a false default would pop the Charter up over the scroll-story hero
    // on every reset instead of showing the intro cleanly.
    expect(state.tourSeen).toBe(false);
    expect(state.welcomeSeen).toBe(true);
    expect(state.page).toBe("map");
    expect(state.selectedCountry).toBeNull();
  });
});
