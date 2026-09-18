import { describe, expect, it } from "vitest";

import { computePaybackRows, computeYearlySavings } from "./payback";

describe("computePaybackRows", () => {
  it("computes a simple flat (no inflation) payback correctly", () => {
    const rows = computePaybackRows([1000, 2000, 3000], 100, 0, 1.0);
    // £100/yr fixed, no growth: 1000/100=10yr, 2000/100=20yr, 3000/100=30yr
    expect(rows[0].paybackYears).toBe(10);
    expect(rows[1].paybackYears).toBe(20);
    expect(rows[2].paybackYears).toBe(30);
  });

  it("returns null when a cost never pays back within 50 years", () => {
    const rows = computePaybackRows([100000, 100000, 100000], 10, 0, 1.0);
    expect(rows[0].paybackYears).toBeNull();
  });

  it("returns a higher IRR for a cheaper install cost, all else equal", () => {
    const rows = computePaybackRows([1000, 2000, 3000], 200, 100, 1.03);
    expect(rows[0].irr).not.toBeNull();
    expect(rows[0].irr!).toBeGreaterThan(rows[1].irr!);
    expect(rows[1].irr!).toBeGreaterThan(rows[2].irr!);
  });

  it("IRR is null when lifetime savings never recover the cost even undiscounted", () => {
    const rows = computePaybackRows([1_000_000, 1_000_000, 1_000_000], 10, 0, 1.0);
    expect(rows[0].irr).toBeNull();
  });

  it("a 0% cost has no defined IRR", () => {
    const rows = computePaybackRows([0, 0, 0], 100, 0, 1.0);
    expect(rows[0].irr).toBeNull();
  });
});

describe("computeYearlySavings", () => {
  it("grows import saving with inflation and holds export saving flat", () => {
    const rows = computeYearlySavings(100, 50, 1.1, 5);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ year: 1, importSaving: 100, exportSaving: 50 });
    expect(rows[4].importSaving).toBe(Math.round(100 * Math.pow(1.1, 4)));
    expect(rows[4].exportSaving).toBe(50);
  });
});
