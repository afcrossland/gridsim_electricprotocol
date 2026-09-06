// One-off data extraction for the consultant-review spreadsheet export
// (scripts/export_consultant_review.py). Not a test - run via vitest purely
// to reuse Vite's existing TS/JSON transform pipeline rather than adding a
// new TS-runner dependency: `npx vitest run scripts/extractCountryData.ts`.
// Writes scripts/_countryData.json, which the Python script then reads.
//
// Reuses the app's own sourcedResponses() (src/data/sourcedAnswers.ts)
// rather than re-deriving the specificity/evidence-basis merge here, so the
// exported spreadsheet always matches exactly what the live app shows -
// see the skill file's warning about keeping that logic in one place.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { it } from "vitest";
import seed from "../src/data/protocol.seed.json";
import { sourcedResponses, sourcedCountries } from "../src/data/sourcedAnswers";
import { jurisdictions } from "../src/lib/jurisdictions";
import { scoreCountry } from "../src/lib/scoring";
import type { Protocol, Question, Section } from "../src/lib/types";

const protocol = seed as unknown as Protocol;
const questions = seed.questions as Question[];
const sections = seed.sections as Section[];
const responses = sourcedResponses(questions);
const codes = sourcedCountries();

const jurisdictionByCode = new Map(jurisdictions.map((j) => [j.code, j]));

const byCountry: Record<
  string,
  {
    name: string;
    completeness: number;
    answers: Record<string, { score: number; evidence: { title: string; source: string; note: string }[] }>;
  }
> = {};

for (const code of codes) {
  const j = jurisdictionByCode.get(code);
  // Not every sourced code is a mappable jurisdiction with its own page
  // (some are transient group-resolution artifacts) - skip anything that
  // isn't a real, mappable jurisdiction so the spreadsheet's tabs match the
  // app's own list of countries you can actually open.
  if (!j || !j.mappable) continue;

  const answers: Record<string, { score: number; evidence: { title: string; source: string; note: string }[] }> = {};
  for (const r of responses) {
    if (r.countryCode !== code) continue;
    answers[r.questionId] = {
      score: r.score,
      evidence: (r.evidence ?? []).map((e) => ({ title: e.title, source: e.source, note: e.note })),
    };
  }
  // Same completeness the app itself ranks and colours the map by - see
  // scoreCountry's own doc comment for the formula.
  const { completeness } = scoreCountry(protocol, questions, responses, code, j.name);
  byCountry[code] = { name: j.name, completeness, answers };
}

const output = {
  sections: sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, title: s.title })),
  questions: questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((q) => ({
      id: q.id,
      sectionId: q.sectionId,
      subsection: q.subsection,
      text: q.text,
      rubric: q.rubric.map((t) => ({ score: t.score, label: t.label })),
    })),
  countries: byCountry,
};

const outPath = fileURLToPath(new URL("./_countryData.json", import.meta.url));
writeFileSync(outPath, JSON.stringify(output));
console.log(`Wrote ${outPath} - ${Object.keys(byCountry).length} countries, ${questions.length} questions`);

// vitest requires at least one test per file to exit 0 - the extraction
// above already ran as a side effect of importing this module, so there's
// nothing left to actually assert here.
it("extracted country data", () => {});
