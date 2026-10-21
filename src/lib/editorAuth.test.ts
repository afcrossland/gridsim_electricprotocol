import { describe, expect, it } from "vitest";

import { canEdit, EDITING_NEEDS_SIGN_IN, useEditorStore } from "./editorAuth";

describe("editorAuth", () => {
  it("needs no sign-in on builds that don't edit the shared database", () => {
    expect(EDITING_NEEDS_SIGN_IN).toBe(false); // VITE_POLICY_API is unset under test
    expect(useEditorStore.getState().status).toBe("not-required");
    expect(canEdit()).toBe(true);
  });

  it("only lets a confirmed editor in when sign-in is needed", () => {
    expect(canEdit({ status: "editor" })).toBe(true);
    for (const status of ["signed-out", "checking", "not-editor", "error"] as const) {
      expect(canEdit({ status })).toBe(false);
    }
  });
});
