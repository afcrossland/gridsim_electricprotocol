import { describe, expect, it } from "vitest";

import { diffResponses } from "./suggestions";
import type { Question, Response } from "./types";

const questions: Question[] = [
  {
    id: "q1",
    sectionId: "s1",
    subsection: null,
    order: 1,
    text: "Is behind-the-meter technology available?",
    weight: 2,
    rubric: [
      { score: 0, label: "Not in place", points: 0 },
      { score: 1, label: "Partly in place", points: 1 },
      { score: 2, label: "Fully in place", points: 4 },
    ],
  },
];

function response(overrides: Partial<Response> = {}): Response {
  return {
    questionId: "q1",
    countryCode: "GB",
    score: 0,
    evidence: [],
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("diffResponses", () => {
  it("reports no changes when nothing differs", () => {
    const before = [response()];
    const after = [response()];
    expect(diffResponses(before, after, questions)).toEqual([]);
  });

  it("reports a score change with tier labels, not raw numbers", () => {
    const before = [response({ score: 0 })];
    const after = [response({ score: 2 })];
    const changes = diffResponses(before, after, questions);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ questionId: "q1", kind: "score" });
    expect(changes[0].description).toContain("Not in place");
    expect(changes[0].description).toContain("Fully in place");
  });

  it("reports a newly answered question (no prior response) as a score change", () => {
    const before: Response[] = [];
    const after = [response({ score: 1 })];
    const changes = diffResponses(before, after, questions);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("score");
    expect(changes[0].description).toContain("no answer");
  });

  it("reports an added evidence item", () => {
    const before = [response({ evidence: [] })];
    const after = [response({ evidence: [{ title: "New law", source: "gov.example", note: "" }] })];
    const changes = diffResponses(before, after, questions);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("evidence-added");
    expect(changes[0].description).toContain("New law");
  });

  it("reports a removed evidence item", () => {
    const before = [response({ evidence: [{ title: "Old law", source: "", note: "" }] })];
    const after = [response({ evidence: [] })];
    const changes = diffResponses(before, after, questions);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("evidence-removed");
    expect(changes[0].description).toContain("Old law");
  });

  it("reports an edited evidence item", () => {
    const before = [response({ evidence: [{ title: "Law", source: "old.example", note: "" }] })];
    const after = [response({ evidence: [{ title: "Law", source: "new.example", note: "" }] })];
    const changes = diffResponses(before, after, questions);
    expect(changes).toHaveLength(1);
    expect(changes[0].kind).toBe("evidence-edited");
  });

  it("reports multiple independent changes together", () => {
    const before = [response({ score: 0, evidence: [] })];
    const after = [response({ score: 2, evidence: [{ title: "New law", source: "", note: "" }] })];
    const changes = diffResponses(before, after, questions);
    expect(changes).toHaveLength(2);
    expect(changes.map((c) => c.kind).sort()).toEqual(["evidence-added", "score"]);
  });
});
