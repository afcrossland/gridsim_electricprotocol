// @vitest-environment node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import seed from "../../data/protocol.seed.json";
import { sourcedResponses } from "../../data/sourcedAnswers";
import { renderReportPdf } from "../../../shared/pdf/renderPdf";
import type { PdfAssets } from "../../../shared/pdf/types";
import { qualifiedName } from "../jurisdictions";
import { rankImpact, scoreCountry, scoreSections } from "../scoring";
import type { Protocol, Response } from "../types";
import { buildPolicyReportModel, type CountryReportData } from "./policyReportModel";

const protocol = seed as unknown as Protocol;
const { questions, sections } = protocol;
const responses = sourcedResponses(questions);

const file = (rel: string) => new Uint8Array(readFileSync(new URL(rel, import.meta.url)));
const assets: PdfAssets = {
  headFont: file("../../../shared/assets/fonts/Eastman-Grotesque-Bold.woff"),
  bodyFont: file("../../../shared/assets/fonts/Eastman-Grotesque-Regular.woff"),
  boldFont: file("../../../shared/assets/fonts/Eastman-Grotesque-Demi-Bold.woff"),
  logo: file("../../../public/favicon.png"),
  logoAspect: 1,
};

function dataFor(code: string, compareCodes: string[] = []): CountryReportData {
  const forCode = (c: string) => {
    const name = qualifiedName(c);
    return {
      code: c,
      name,
      score: scoreCountry(protocol, questions, responses, c, name),
      sections: scoreSections(protocol, sections, questions, responses, c),
      byQuestion: new Map(responses.filter((r) => r.countryCode === c).map((r) => [r.questionId, r])) as Map<string, Response>,
    };
  };
  const main = forCode(code);
  return {
    countryCode: code,
    countryName: main.name,
    generatedOn: "1 January 2026",
    score: main.score,
    sectionScores: main.sections,
    impact: rankImpact(protocol, questions, sections, responses, code),
    sections,
    questions,
    byQuestion: main.byQuestion,
    exemplars: { [sections[0].id]: ["NZ", "JP"].filter((c) => c !== code).map((c) => ({ code: c, name: qualifiedName(c), byQuestion: forCode(c).byQuestion })) },
    compareEntries: compareCodes.map((c) => {
      const e = forCode(c);
      return { code: c, name: e.name, color: "#008194", score: e.score, sections: e.sections, byQuestion: e.byQuestion };
    }),
  };
}

const text = (pdf: Uint8Array) => Buffer.from(pdf).toString("latin1");

describe("the Policy report PDF", () => {
  for (const [name, code, compare] of [
    ["single-country", "GB", []],
    ["with-comparison", "GB", ["NZ", "JP"]],
  ] as [string, string, string[]][]) {
    it(`${name}: is a tagged PDF/UA file with a title, a language and pages`, async () => {
      const pdf = await renderReportPdf(buildPolicyReportModel(dataFor(code, compare)), assets);
      // veraPDF reads these in CI and locally.
      mkdirSync("test-output/reports", { recursive: true });
      writeFileSync(`test-output/reports/policy-${name}.pdf`, pdf);
      const raw = text(pdf);
      expect(raw.startsWith("%PDF-1.7")).toBe(true);
      expect(raw).toContain("/Marked true");
      expect(raw).toContain("pdfuaid:part");
      expect(raw).toContain("/Lang (en-GB)");
      expect(raw).toContain("/DisplayDocTitle true");
      expect(pdf.length).toBeGreaterThan(20_000);
    });
  }

  it("makes web addresses in evidence clickable, inside the tag tree", async () => {
    const pdf = await renderReportPdf(buildPolicyReportModel(dataFor("GB")), assets);
    const raw = text(pdf);
    expect(raw).toContain("/Subtype /Link");
    expect(raw).toContain("/S /URI");
    // Each link annotation sits in a Link structure element, as PDF/UA needs.
    expect(raw).toContain("/S /Link");
    expect(raw).toMatch(/\/URI \(https?:\/\//);
  });

  it("has wording for every block and mentions every section", () => {
    const model = buildPolicyReportModel(dataFor("GB", ["NZ"]));
    const all = JSON.stringify(model.pages);
    expect(all).not.toContain("undefined");
    expect(all).not.toContain("{{");
    for (const section of sections) expect(all).toContain(section.title);
    expect(all).toContain("out of 5 suns");
    expect(all).toContain('"text":"Detail"');
    expect(all).not.toContain("every question");
    // Every answered question shows how it scores, in the ladder's words.
    expect(all).toMatch(/Score: (Strong|Developed|Weak)"/);
    expect(all).not.toMatch(/Score: (Strong|Developed|Weak) \(/);
    // Renamed everywhere: no "data completeness" in the report.
    expect(all.toLowerCase()).not.toContain("completeness");
  });

  it("says plainly when a country has too little data to be scored", () => {
    const model = buildPolicyReportModel(dataFor("ZZ"));
    expect(JSON.stringify(model.pages)).toContain("does not yet have enough answered data");
  });
});
