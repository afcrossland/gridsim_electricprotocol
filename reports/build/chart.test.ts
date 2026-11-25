// @vitest-environment node
/// <reference lib="dom" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// @ts-expect-error jsdom has no types here
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { parseChart, parseCsv } from "./chart.ts";
import { parsePost } from "./posts.ts";
import { renderPost } from "./render.ts";

const fail = (message: string): never => {
  throw new Error(message);
};
const block = (details: Record<string, unknown> = {}, data = "Year, A, B\n2024, 1, 2\n2025, 3, 4") =>
  Object.entries({ type: "line", title: "T", description: "D.", data, ...details })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
const chart = (details?: Record<string, unknown>, data?: string) => parseChart(block(details, data), () => "Year,A\n1,2\n2,3", fail);
const SITE = { base: "/", url: "", noindex: false };
const post = (body: string) => renderPost(parsePost("a-post", "/x", `---\ntitle: T\nkind: report\ndate: 2026-01-01\nsummary: S\nsources:\n  - label: One\n---\n${body}`, []), SITE);
const fenced = (text: string) => "```chart\n" + text + "\n```\n";

describe("reading charts", () => {
  it("reads numbers, gaps, quoted cells and a CSV file", () => {
    expect(chart({}, "Year, A\n2024, -1.5\n2025,\n2026, 1e3").series[0].values).toEqual([-1.5, null, 1000]);
    expect(parseCsv('\uFEFF"a, ""b""",c\r\n\r\n1,2\r\n')).toEqual([['a, "b"', "c"], ["1", "2"]]);
    expect(chart({ data: "x.csv" })).toMatchObject({ file: "x.csv", axis: "Year", labels: ["1", "2"] });
  });

  it.each([
    ["an unknown type", { type: "pie" }, undefined, '"type"'],
    ["a misspelt detail", { tpye: "x" }, undefined, 'unknown detail "tpye"'],
    ["no title", { title: undefined }, undefined, '"title" is missing'],
    ["no description", { description: undefined }, undefined, '"description" is missing'],
    ["a stacked line", { stacked: true }, undefined, "stacked"],
    ["too many columns", {}, "Y,A,B,C,D,E\n1,1,1,1,1,1\n2,1,1,1,1,1", "too many"],
    ["a row that is short", {}, "Y,A,B\n1,1\n2,1,1", "has 2 values"],
    ["a number with a unit", {}, "Y,A\n1,5 GW\n2,6", "not a number"],
    ["a hexadecimal number", {}, "Y,A\n1,0x10\n2,6", "not a number"],
    ["one row", {}, "Y,A\n1,5", "at least two rows"],
    ["the same label twice", {}, "Y,A\n1,5\n1,6", "own label"],
    ["two columns with one name", {}, "Y,A,A\n1,5,5\n2,6,6", "own heading"],
    ["a column with no numbers", {}, "Y,A,B\n1,5,\n2,6,", "no numbers"],
    ["years out of order", {}, "Y,A\n2025,5\n2024,6", "go up"],
    ["more columns than a phone can show", { type: "column" }, "Y,A,B\n" + Array.from({ length: 31 }, (_, i) => `${i},1,1`).join("\n"), "won't fit"],
    ["a negative in a stack", { type: "bar", stacked: true }, "Y,A\nx,-5\ny,6", "below zero"],
  ])("refuses %s", (_what, details, data, message) => {
    expect(() => chart(details, data)).toThrow(message);
  });

  it("says how to fix an unquoted colon, and refuses a CSV that is not there", () => {
    expect(() => parseChart("title: a: b", () => "", fail)).toThrow("quotes");
    expect(() => parseChart("unit: %", () => "", fail)).toThrow("such as %");
    expect(() => post(fenced(block({ data: "../x.csv" })))).toThrow("not in the folder");
  });
});

describe("chart pages", () => {
  it("has the script only where there is a chart, escapes labels, and cites in the caption", () => {
    const html = post(fenced(block({ caption: "Source.[^1]" }, "Year, </script><b>\n2024, 1\n2025, 2")));
    expect(html).toContain("figure.chart");
    expect(html).not.toContain("</script><b>");
    expect(html).toContain("\\u003c/script>");
    expect(html).toContain('Source.<sup class="cite">[<a id="cite_1"');
    expect(post("Hello\n\n```js\nx\n```")).not.toContain("<script");
  });
});

describe("drawing charts", () => {
  const script = readFileSync(fileURLToPath(new URL("./chart.client.js", import.meta.url)), "utf8");
  const draw = (details: Record<string, unknown>, data?: string) => {
    const { window } = new JSDOM(post(fenced(block(details, data))), { runScripts: "outside-only" });
    Object.defineProperty(window.HTMLElement.prototype, "clientWidth", { get: () => 700 });
    window.eval(script);
    const plot = window.document.querySelector(".plot") as HTMLElement;
    const press = (key: string) => plot.dispatchEvent(new window.KeyboardEvent("keydown", { key }));
    return { plot, press };
  };

  it.each([
    ["line", { type: "line" }, undefined, "path.line", 2],
    ["line with a gap", { type: "line" }, "Y,A\n1,1\n2,\n3,4", "path.line", 1],
    ["column", { type: "column" }, undefined, "path.fill", 4],
    ["stacked column", { type: "column", stacked: true }, undefined, "path.fill", 4],
    ["bar with negatives", { type: "bar" }, "N,A\nx,-5\ny,6", "path.fill", 2],
    ["bar of zeros", { type: "bar" }, "N,A\nx,0\ny,0", "path.fill", 0],
  ])("draws a %s chart with no bad coordinates", (_what, details, data, selector, count) => {
    const { plot } = draw(details, data);
    expect(plot.querySelectorAll(selector)).toHaveLength(count);
    expect(plot.innerHTML).not.toMatch(/NaN|Infinity|undefined/);
  });

  const texts = (plot: HTMLElement, selector: string) => Array.from(plot.querySelectorAll(selector)).map((e) => e.textContent);

  it("labels ticks and small values as they are", () => {
    expect(texts(draw({ type: "column" }, "Y,A\na,0.12\nb,0.05").plot, "text")).toEqual(expect.arrayContaining(["0", "0.025", "0.075", "0.125"]));
    const { plot, press } = draw({ type: "column" }, "Y,A\na,-0.001\nb,0.004");
    expect(new Set(texts(plot, "text")).size).toBe(texts(plot, "text").length);
    press("Home");
    expect(plot.querySelector(".sr")!.textContent).toBe("a: A -0.001");
    expect(texts(draw({ type: "bar", stacked: true }, "Y,A,B\na,0.1,0.2\nb,1,2").plot, ".value")).toEqual(["0.3", "3"]);
    expect(texts(draw({ type: "bar" }, "Y,A\na,0.0012345\nb,12345.6").plot, ".value")).toEqual(["0.001235", "12,346"]);
  });

  it("reads out values with the arrow keys", () => {
    const { plot, press } = draw({ unit: "GW" });
    press("ArrowRight");
    expect(plot.querySelector(".sr")!.textContent).toBe("2024: A 1 GW, B 2 GW");
    press("End");
    expect(plot.querySelector(".tip")!.textContent).toContain("3 GW");
    press("Escape");
    expect(plot.querySelector<HTMLElement>(".tip")!.hidden).toBe(true);
  });
});
