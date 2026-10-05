import { describe, expect, it } from "vitest";
import { FGS_URL, fgsCodeFor, fgsUrlFor } from "./fgsLink";

describe("fgsLink", () => {
  it("passes through codes FGS shares with EP", () => {
    expect(fgsCodeFor("DE")).toBe("DE");
    expect(fgsUrlFor("DE")).toBe(`${FGS_URL}?country=DE&skipIntro=1`);
  });

  it("renames codes FGS spells differently", () => {
    expect(fgsCodeFor("MY")).toBe("MY1");
  });

  it("has no region for countries FGS splits or lacks", () => {
    for (const code of ["US", "BR", "CA", "JP", "AU", "ZZ"]) {
      expect(fgsCodeFor(code)).toBeNull();
      expect(fgsUrlFor(code)).toBe(FGS_URL);
    }
  });
});
