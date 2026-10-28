import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import seedJson from "./protocol.seed.json";

/** A fresh copy of the module each time - it holds load state. */
async function freshModule() {
  vi.resetModules();
  return import("./policyData");
}

function respond(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

const apiData = {
  protocol: { ...seedJson, title: "From the database" },
  jurisdictions: [{ code: "XX", name: "Test", level: "country", parent: null, region: null, mappable: true }],
  sourced: { sources: {}, groups: {}, answers: [] },
  indicator: { sources: {}, groups: {}, answers: [] },
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("policyData", () => {
  it("starts as the bundled JSON", async () => {
    const m = await freshModule();
    expect(m.readPolicyData().protocol).toEqual(seedJson);
    expect(m.policyDataSource()).toBe("bundled");
  });

  it("gives every question a short title for its card", () => {
    for (const q of seedJson.questions) {
      expect((q as { title?: string }).title, q.id).toMatch(/\S/);
      expect((q as { title?: string }).title!.length, q.id).toBeLessThanOrEqual(60);
    }
  });

  it("uses the API's data when it answers with the right shape", async () => {
    const m = await freshModule();
    expect(await m.loadPolicyData({ fetchImpl: respond(apiData) })).toBe("api");
    expect(m.readPolicyData().protocol.title).toBe("From the database");
    expect(m.readPolicyData().jurisdictions).toHaveLength(1);
  });

  it.each([
    ["an error status", respond({ error: "not configured" }, 503)],
    ["the wrong shape", respond({ protocol: {} })],
    ["HTML (an SPA fallback page)", (async () => new Response("<!doctype html>", { status: 200 })) as unknown as typeof fetch],
    ["a network failure", (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch],
  ])("keeps the bundled JSON on %s", async (_label, fetchImpl) => {
    const m = await freshModule();
    expect(await m.loadPolicyData({ fetchImpl })).toBe("bundled");
    expect(m.readPolicyData().protocol).toEqual(seedJson);
    expect(console.warn).toHaveBeenCalled();
  });

  it("gives up after the timeout", async () => {
    const m = await freshModule();
    const hang = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) =>
        init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
      )) as unknown as typeof fetch;
    expect(await m.loadPolicyData({ fetchImpl: hang, timeoutMs: 10 })).toBe("bundled");
    expect(m.readPolicyData().protocol).toEqual(seedJson);
  });

  it("refuses to replace data something has already read", async () => {
    const m = await freshModule();
    m.readPolicyData();
    const fetchImpl = respond(apiData);
    expect(await m.loadPolicyData({ fetchImpl })).toBe("bundled");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(m.readPolicyData().protocol).toEqual(seedJson);
  });
});
