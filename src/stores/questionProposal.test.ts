import { describe, expect, it } from "vitest";
import { useProtocolStore } from "./protocolStore";

describe("question proposals", () => {
  it("adds nothing until accepted, then adds a three-tier question, and removes it again on reject", () => {
    const store = useProtocolStore;
    const sectionId = store.getState().sections[0].id;
    const countBefore = store.getState().questions.length;

    store.getState().submitQuestionProposal({
      sectionId,
      sectionTitle: "x",
      text: "Is there a national rooftop solar target?",
      strongLabel: "Binding target with a deadline",
      developedLabel: "Non-binding target",
      weakLabel: "No target",
      reason: "Targets drive investment",
      source: "IEA report",
      submitterName: "Test Person",
      submitterOrganisation: "",
    });
    const proposal = store.getState().questionProposals.at(-1)!;
    expect(proposal.status).toBe("pending");
    expect(store.getState().questions.length).toBe(countBefore);

    store.getState().reviewQuestionProposal(proposal.id, "accepted", 2);
    const added = store.getState().questions.find((q) => q.text === "Is there a national rooftop solar target?")!;
    expect(store.getState().questions.length).toBe(countBefore + 1);
    expect(added.weight).toBe(2);
    expect(added.rubric.map((t) => [t.score, t.points])).toEqual([[0, 0], [1, 1], [2, 4]]);
    expect(added.rubric[2].label).toBe("Binding target with a deadline");

    store.getState().reviewQuestionProposal(proposal.id, "rejected");
    expect(store.getState().questions.length).toBe(countBefore);
  });

  it("builds a two-tier question when no developed answer is given", () => {
    const store = useProtocolStore;
    store.getState().submitQuestionProposal({
      sectionId: store.getState().sections[0].id,
      sectionTitle: "x",
      text: "Is net metering allowed?",
      strongLabel: "Allowed",
      developedLabel: "",
      weakLabel: "Not allowed",
      reason: "r",
      source: "s",
      submitterName: "n",
      submitterOrganisation: "",
    });
    const proposal = store.getState().questionProposals.at(-1)!;
    store.getState().reviewQuestionProposal(proposal.id, "accepted");
    const q = store.getState().questions.find((x) => x.text === "Is net metering allowed?")!;
    expect(q.rubric.map((t) => [t.score, t.points])).toEqual([[0, 0], [2, 4]]);
  });
});
