import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "electric-protocol-policy-map";
const memory = new Map<string, string>();
const storage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
};

/** A public build: `PROD`, with or without the database flag. */
async function publicBuild(policyApi: string) {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_POLICY_API", policyApi);
  vi.stubGlobal("localStorage", storage);
  const auth = await import("../lib/editorAuth");
  const store = await import("./protocolStore");
  return { auth, store };
}

beforeEach(() => memory.clear());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public build without the database", () => {
  it("has no editing", async () => {
    const { auth } = await publicBuild("");
    expect(auth.EDITING_CLOSED).toBe(true);
    expect(auth.useEditorStore.getState().status).toBe("closed");
    expect(auth.canEdit()).toBe(false);
    expect(auth.editsSaveToDatabase()).toBe(false);
  });

  it("ignores edits an open console left behind, and keeps a copy", async () => {
    const { store: pristine } = await publicBuild("");
    const question = pristine.useProtocolStore.getState().questions[0];
    const saved = { questionOverrides: { [question.id]: { text: "EDITED" } }, removedQuestionIds: [], mapMetric: "total", welcomeSeen: true };
    memory.set(KEY, JSON.stringify({ state: saved, version: 11 }));
    const { store } = await publicBuild("");
    await vi.waitFor(() => expect(store.useProtocolStore.getState().welcomeSeen).toBe(true));
    const live = store.useProtocolStore.getState();
    expect(live.questions.find((q) => q.id === question.id)?.text).toBe(question.text);
    expect(JSON.parse(memory.get(store.BROWSER_EDITS_BACKUP_KEY)!).questionOverrides).toEqual(saved.questionOverrides);
    live.setWelcomeSeen(true);
    expect(memory.get(KEY)).not.toContain("EDITED");
  });

  it("leaves no backup when there was nothing to keep", async () => {
    memory.set(KEY, JSON.stringify({ state: { welcomeSeen: true, responses: [], questionOverrides: {} }, version: 11 }));
    const { store } = await publicBuild("");
    expect(memory.has(store.BROWSER_EDITS_BACKUP_KEY)).toBe(false);
  });
});

describe("other builds", () => {
  it("a public database build still asks editors to sign in", async () => {
    const { auth } = await publicBuild("1");
    expect(auth.EDITING_CLOSED).toBe(false);
    expect(auth.useEditorStore.getState().status).toBe("signed-out");
  });
});
