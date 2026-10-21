import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  diffSnapshots,
  requestFor,
  startPolicySync,
  useSyncStore,
  withoutSaving,
  type SyncRequest,
  type SyncSnapshot,
} from "./policySync";
import type { QuestionProposal, Suggestion } from "./suggestions";
import type { Question, Response, Section } from "./types";

const section: Section = { id: "s1", title: "Access", order: 0 };
const question: Question = {
  id: "q1",
  sectionId: "s1",
  subsection: null,
  order: 0,
  text: "Is there finance?",
  weight: 3,
  rubric: [
    { score: 0, label: "No", points: 0 },
    { score: 2, label: "Yes", points: 4 },
  ],
};
const answer: Response = { questionId: "q1", countryCode: "AT", score: 2, evidence: [], updatedAt: "", seeded: true };
const suggestion: Suggestion = {
  id: "sg-1",
  countryCode: "AT",
  countryName: "Austria",
  submitterName: "Ada",
  submitterOrganisation: "",
  submittedAt: "",
  status: "pending",
  changes: [],
  baseline: [],
  proposed: [],
};
const proposal: QuestionProposal = {
  id: "qp-1",
  sectionId: "s1",
  sectionTitle: "Access",
  text: "New?",
  strongLabel: "Yes",
  developedLabel: "",
  weakLabel: "No",
  reason: "",
  source: "",
  submitterName: "Bo",
  submitterOrganisation: "",
  submittedAt: "",
  status: "pending",
};
const base: SyncSnapshot = {
  sections: [section],
  questions: [question],
  responses: [answer],
  threshold: 0.3,
  suggestions: [suggestion],
  questionProposals: [proposal],
};

describe("diffSnapshots", () => {
  it("finds exactly what an immutable update replaced", () => {
    const next = { ...base, questions: [{ ...question, text: "Reworded" }] };
    expect(diffSnapshots(base, next)).toEqual(["question:q1"]);
    expect(diffSnapshots(base, { ...base })).toEqual([]);
  });

  it("sees additions, removals and settings", () => {
    const next: SyncSnapshot = {
      ...base,
      sections: [section, { id: "s2", title: "New", order: 1 }],
      questions: [],
      responses: [],
      threshold: 0.5,
    };
    expect(diffSnapshots(base, next).sort()).toEqual(["protocol", "question:q1", "response:AT|q1", "section:s2"]);
  });
});

describe("requestFor", () => {
  it("puts what exists and deletes what doesn't", () => {
    expect(requestFor("section:s1", base)).toEqual({
      order: 0,
      request: { method: "PUT", url: "/api/policy/sections/s1", body: { title: "Access", order: 0 } },
    });
    expect(requestFor("question:gone", base)).toEqual({ order: 3, request: { method: "DELETE", url: "/api/policy/questions/gone" } });
    expect(requestFor("section:gone", base).order).toBe(4);
  });

  it("saves a removed answer as cleared, so the researched one stays hidden", () => {
    expect(requestFor("response:AT|q1", { ...base, responses: [] }).request).toEqual({
      method: "PUT",
      url: "/api/policy/responses/AT/q1",
      body: { score: null, evidence: [] },
    });
    expect(requestFor("response:AT|q1", base).request.body).toEqual({ score: 2, basis: null, evidence: [] });
  });
});

describe("startPolicySync", () => {
  type Listener = (next: SyncSnapshot, prev: SyncSnapshot) => void;
  let listener: Listener;
  let state: SyncSnapshot;
  let sent: SyncRequest[];
  const subscribe = (l: Listener) => {
    listener = l;
    return () => {};
  };
  const change = (next: SyncSnapshot) => {
    const prev = state;
    state = next;
    listener(next, prev);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    useSyncStore.setState({ pending: 0, error: null });
    state = base;
    sent = [];
  });
  afterEach(() => vi.useRealTimers());

  it("waits until typing settles, then sends the latest state once", async () => {
    startPolicySync(subscribe, () => state, async (r) => void sent.push(r), 800);
    for (const text of ["R", "Re", "Reworded"]) {
      change({ ...state, questions: [{ ...question, text }] });
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(sent).toEqual([]);
    expect(useSyncStore.getState().pending).toBe(1);
    await vi.advanceTimersByTimeAsync(800);
    expect(sent).toHaveLength(1);
    expect((sent[0].body as { text: string }).text).toBe("Reworded");
    expect(useSyncStore.getState().pending).toBe(0);
  });

  it("creates parents before children and deletes children before parents", async () => {
    startPolicySync(subscribe, () => state, async (r) => void sent.push(r), 10);
    const s2: Section = { id: "s2", title: "New", order: 1 };
    const q2: Question = { ...question, id: "q2", sectionId: "s2" };
    change({ ...state, questions: [...state.questions, q2], sections: [...state.sections, s2] });
    await vi.advanceTimersByTimeAsync(20);
    expect(sent.map((r) => `${r.method} ${r.url}`)).toEqual(["PUT /api/policy/sections/s2", "PUT /api/policy/questions/q2"]);

    sent = [];
    change({ ...state, sections: [section], questions: [question] });
    await vi.advanceTimersByTimeAsync(20);
    expect(sent.map((r) => `${r.method} ${r.url}`)).toEqual(["DELETE /api/policy/questions/q2", "DELETE /api/policy/sections/s2"]);
  });

  it("reports the first failure and keeps saving the rest", async () => {
    startPolicySync(
      subscribe,
      () => state,
      async (r) => {
        sent.push(r);
        if (r.url.includes("sections")) throw new Error("No section s9.");
      },
      10,
    );
    change({ ...state, sections: [{ ...section, title: "Renamed" }], threshold: 0.4 });
    await vi.advanceTimersByTimeAsync(20);
    expect(sent).toHaveLength(2);
    expect(useSyncStore.getState().error).toBe("No section s9.");
  });
});

describe("review decisions", () => {
  it("are saved only when a decision changes, not when lists arrive from the server", () => {
    const loaded = { ...base, suggestions: [{ ...suggestion }, { ...suggestion, id: "sg-2" }] };
    expect(diffSnapshots(base, loaded)).toEqual([]); // same decision; sg-2 is new from the server
    const accepted = { ...base, suggestions: [{ ...suggestion, status: "accepted" as const }] };
    expect(diffSnapshots(base, accepted)).toEqual(["suggestion:sg-1"]);
    expect(requestFor("suggestion:sg-1", accepted).request).toEqual({
      method: "PUT",
      url: "/api/policy/suggestions/sg-1/status",
      body: { status: "accepted" },
    });
  });

  it("save an accepted proposal after the question it adds", async () => {
    vi.useFakeTimers();
    let listener: (next: SyncSnapshot, prev: SyncSnapshot) => void = () => {};
    let state = base;
    const sent: SyncRequest[] = [];
    startPolicySync((l) => ((listener = l), () => {}), () => state, async (r) => void sent.push(r), 10);
    const prev = state;
    state = {
      ...state,
      questions: [...state.questions, { ...question, id: "q-new" }],
      questionProposals: [{ ...proposal, status: "accepted", questionId: "q-new" }],
    };
    listener(state, prev);
    await vi.advanceTimersByTimeAsync(20);
    expect(sent.map((r) => `${r.method} ${r.url}`)).toEqual([
      "PUT /api/policy/questions/q-new",
      "PUT /api/policy/question-proposals/qp-1/status",
    ]);
    expect(sent[1].body).toEqual({ status: "accepted", questionId: "q-new" });
    vi.useRealTimers();
  });

  it("ignores state applied withoutSaving", async () => {
    vi.useFakeTimers();
    let listener: (next: SyncSnapshot, prev: SyncSnapshot) => void = () => {};
    const sent: SyncRequest[] = [];
    startPolicySync((l) => ((listener = l), () => {}), () => base, async (r) => void sent.push(r), 10);
    withoutSaving(() => listener({ ...base, suggestions: [{ ...suggestion, status: "rejected" }] }, base));
    await vi.advanceTimersByTimeAsync(20);
    expect(sent).toEqual([]);
    vi.useRealTimers();
  });
});
