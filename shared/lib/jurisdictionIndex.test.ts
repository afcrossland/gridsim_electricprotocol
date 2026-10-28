import { describe, expect, it } from "vitest";

import { createJurisdictionIndex, type Jurisdiction } from "./jurisdictionIndex";

const list: Jurisdiction[] = [
  { code: "AU", name: "Australia", level: "country", parent: null, region: "Australia and New Zealand", mappable: false },
  { code: "AU-SA", name: "South Australia", level: "subnational", parent: "AU", region: "Australia", mappable: true },
  { code: "AU-NT", name: "Northern Territory", level: "subnational", parent: "AU", region: "Australia", mappable: true },
  { code: "FR", name: "France", level: "country", parent: null, region: "Western Europe", mappable: true },
  { code: "FR-GF", name: "French Guiana", level: "subnational", parent: "FR", region: "France", mappable: true },
  { code: "GB", name: "United Kingdom", level: "country", parent: null, region: "Northern Europe", mappable: true },
];

describe("createJurisdictionIndex", () => {
  const j = createJurisdictionIndex(list);

  it("looks jurisdictions up by code and names them, falling back to the code", () => {
    expect(j.getJurisdiction("GB")?.name).toBe("United Kingdom");
    expect(j.jurisdictionName("GB")).toBe("United Kingdom");
    expect(j.jurisdictionName("ZZ")).toBe("ZZ");
    expect(j.qualifiedName("AU-SA")).toBe("South Australia, Australia");
    expect(j.qualifiedName("GB")).toBe("United Kingdom");
  });

  it("translates names where it can and falls back to English where it cannot", () => {
    expect(j.jurisdictionName("GB", "fr")).toMatch(/Royaume-Uni/);
    expect(j.jurisdictionName("AU-SA", "xx")).toBe("South Australia");
  });

  it("treats only a country with no shape of its own as subdivided (France has children but still a shape)", () => {
    expect(j.isSubdivided("AU")).toBe(true);
    expect(j.isSubdivided("FR")).toBe(false);
    expect(j.resolveTargets("AU")).toEqual(["AU-SA", "AU-NT"]);
    expect(j.resolveTargets("FR")).toEqual(["FR"]);
    expect(j.canonicalCode("AU-SA")).toBe("AU");
    expect(j.canonicalCode("FR-GF")).toBe("FR-GF");
  });

  it("finds a jurisdiction's sub-region and continent, walking up to the parent and honouring overseas overrides", () => {
    expect(j.subregionOf("GB")).toBe("Northern Europe");
    expect(j.continentOf("GB")).toBe("Europe");
    expect(j.subregionOf("AU-SA")).toBe("Australia and New Zealand");
    // French Guiana is in South America, not Western Europe, whatever its parent's region says.
    expect(j.subregionOf("FR-GF")).toBe("South America");
    expect(j.continentOf("FR-GF")).toBe("South America");
  });
});
