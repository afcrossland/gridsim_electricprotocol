import { describe, expect, it, vi } from "vitest";

import seed from "../data/protocol.seed.json";
import sourced from "../data/sourced-answers.json";
import indicator from "../data/indicator-answers.json";
import jurisdictions from "../data/jurisdictions.json";
import { canEdit, EDITING_NEEDS_SIGN_IN, editsSaveToDatabase, useEditorStore } from "./editorAuth";

describe("editorAuth", () => {
  it("needs no sign-in on builds that don't edit the shared database", () => {
    expect(EDITING_NEEDS_SIGN_IN).toBe(false); // VITE_POLICY_API is unset under test
    expect(useEditorStore.getState().status).toBe("not-required");
    expect(canEdit()).toBe(true);
  });

  it("only lets a confirmed editor in when sign-in is needed", () => {
    for (const status of ["signed-out", "checking", "not-editor", "error"] as const) {
      expect(canEdit({ status })).toBe(false);
    }
  });

  it("keeps even an editor out while the page is on its bundled fallback", async () => {
    // Saving would write the stale bundled copy over the database.
    expect(canEdit({ status: "editor" })).toBe(false);
    expect(editsSaveToDatabase({ status: "editor" })).toBe(false);

    vi.resetModules();
    const { loadPolicyData } = await import("../data/policyData");
    // Built from the files, not readPolicyData(): reading would lock the data against the load.
    const body = { protocol: seed, jurisdictions, sourced, indicator, responses: [] };
    await loadPolicyData({ fetchImpl: (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch });
    const fresh = await import("./editorAuth");
    expect(fresh.canEdit({ status: "editor" })).toBe(true);
    expect(fresh.editsSaveToDatabase({ status: "editor" })).toBe(true);
  });
});
