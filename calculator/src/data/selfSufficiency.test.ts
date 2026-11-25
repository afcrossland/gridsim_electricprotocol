import { describe, expect, it } from "vitest";

import { computeSelfSufficiency } from "../lib/selfSufficiency";
import stored from "./country-self-sufficiency.json";

describe("country-self-sufficiency.json", () => {
  // The file is committed, not built, so a change to the generation, demand or dispatch model leaves it behind: the
  // local-solar-time fix of 2026-10-16 did, for five weeks. If this fails, run
  // `cd calculator && npx tsx scripts/build_self_sufficiency.ts` and review the differences.
  it("is what the calculator's own model gives", async () => {
    expect(await computeSelfSufficiency()).toEqual(stored);
  }, 60_000);

  it("rises with the size of the system", () => {
    for (const [code, t] of Object.entries(stored)) expect(t.low <= t.medium && t.medium <= t.high, code).toBe(true);
  });
});
