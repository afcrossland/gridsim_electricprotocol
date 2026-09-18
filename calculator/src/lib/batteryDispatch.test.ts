import { describe, expect, it } from "vitest";

import { simulateDispatch } from "./batteryDispatch";

describe("simulateDispatch", () => {
  it("with no battery, self-consumption is just the hourly overlap of generation and demand", () => {
    const generation = [5, 0, 3];
    const demand = [2, 2, 2];
    const r = simulateDispatch(generation, demand, 0);
    // hour0: min(5,2)=2 self-consumed, 3 exported; hour1: 0 self-consumed, 2 imported; hour2: min(3,2)=2 self-consumed, 1 exported
    expect(r.selfConsumedKWh).toBeCloseTo(4);
    expect(r.exportedKWh).toBeCloseTo(4);
    expect(r.importedKWh).toBeCloseTo(2);
  });

  it("a battery shifts surplus generation into a later deficit hour", () => {
    const generation = [10, 0];
    const demand = [2, 5];
    const noBattery = simulateDispatch(generation, demand, 0);
    const withBattery = simulateDispatch(generation, demand, 5);
    expect(withBattery.selfConsumedKWh).toBeGreaterThan(noBattery.selfConsumedKWh);
    expect(withBattery.importedKWh).toBeLessThan(noBattery.importedKWh);
  });

  it("energy is conserved: self-consumed + exported + imported accounts for generation and demand", () => {
    const generation = [4, 1, 6, 0];
    const demand = [1, 3, 2, 2];
    const r = simulateDispatch(generation, demand, 3);
    const totalGeneration = generation.reduce((a, b) => a + b, 0);
    const totalDemand = demand.reduce((a, b) => a + b, 0);
    // Self-consumed + exported = generation, minus whatever's still sitting in the battery at year-end.
    expect(r.selfConsumedKWh + r.exportedKWh).toBeLessThanOrEqual(totalGeneration + 0.001);
    expect(r.selfConsumedKWh + r.importedKWh).toBeCloseTo(totalDemand, 5);
  });
});
