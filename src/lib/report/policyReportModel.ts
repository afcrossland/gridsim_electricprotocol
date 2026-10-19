import type { ReportModel, ReportPage } from "../../../shared/pdf/types";
import { capitalizeFirst } from "../text";
import { impactLabel, scoreSuns } from "../scoring";
import type { CountryScore, ImpactItem, Question, Response, Section } from "../types";

export interface CompareEntry {
  code: string;
  name: string;
  /** Assigned via compareColorFor in lib/compareColors.ts. */
  color: string;
  score: CountryScore;
  sections: { section: Section; score: CountryScore }[];
  byQuestion: Map<string, Response>;
}

/** A strong performer in a section, with its answer to every question, for the "biggest policy wins" exemplars. */
export interface ExemplarRef {
  code: string;
  name: string;
  byQuestion: Map<string, Response>;
}

export interface CountryReportData {
  countryCode: string;
  countryName: string;
  generatedOn: string;
  score: CountryScore;
  sectionScores: { section: Section; score: CountryScore }[];
  impact: ImpactItem[];
  sections: Section[];
  questions: Question[];
  byQuestion: Map<string, Response>;
  /** Empty outside compare mode - adds the compare table. */
  compareEntries: CompareEntry[];
  /** Each section's exemplar pool (best first), keyed by section id. */
  exemplars: Record<string, ExemplarRef[]>;
}

/** GSC brand colours (shared/theme/mui-theme.tsx), as plain hex for the PDF. */
const BRAND = {
  primary: "#00ABBB", // GSC Aqua
  heading: "#008194", // GSC Teal
  text: "#3B3838", // GSC Deep Gray
  line: "#E5E7EB",
  author: "Global Solar Council",
};
const TEAL = "#00ABBB";
const AMBER = "#FBB114";
const WINS_LIMIT = 20;
const EXEMPLAR_LIMIT = 3;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const scoreText = (s: CountryScore) => (s.ranked ? pct(s.score) : "N/A");

/** "4 out of 5 suns (79%)": written in words as well as drawn, so it reads aloud and survives any font. */
const starsPhrase = (s: CountryScore) =>
  s.ranked ? `${scoreSuns(s.score)} out of 5 suns (${pct(s.score)})` : "not yet scored";

const answerLabel = (q: Question, r: Response | undefined) => {
  const tier = r ? q.rubric.find((t) => t.score === r.score)?.label : undefined;
  return tier ? capitalizeFirst(tier) : "Not yet answered";
};

/**
 * How this answer scores, in the same words as the answer ladder in the app (Strong / Developed / Weak, by the answer's
 * place among the question's options) - so a reader sees what the answer is worth, not just what it says. Empty
 * when the question has no answer.
 */
const scoreLine = (q: Question, r: Response | undefined): string => {
  if (!r) return "";
  const tiers = [...q.rubric].sort((a, b) => a.score - b.score);
  const index = tiers.findIndex((t) => t.score === r.score);
  if (index === -1) return "";
  const word = index === tiers.length - 1 ? "Strong" : index === 0 ? "Weak" : "Developed";
  return word;
};

const evidenceText = (r: Response | undefined) =>
  r?.evidence?.length
    ? r.evidence
        .map((e) => [e.title, e.source].filter(Boolean).join(" - ") || "Evidence")
        .join("; ")
    : r
      ? "No evidence provided"
      : "";

export function buildPolicyReportModel(data: CountryReportData): ReportModel {
  const { score, countryName } = data;
  const sectionRows = data.sectionScores.map(({ section, score: s }) => ({ section, s }));

  const cover: ReportPage = {
    cover: true,
    blocks: [
      { type: "title" as const, kicker: "Policy assessment report for", text: countryName, sub: `Generated ${data.generatedOn}` },
      { type: "heading" as const, text: "Key metrics" },
      {
        type: "para" as const,
        style: "lead" as const,
        text: score.ranked
          ? `${countryName} is rated ${starsPhrase(score)}, based on ${score.answered} of ${score.total} questions answered.`
          : `${countryName} does not yet have enough answered data to be scored - ${score.answered} of ${score.total} questions answered so far.`,
      },
      {
        type: "metrics" as const,
        items: [
          { label: "Overall score", value: scoreText(score), suns: score.ranked ? scoreSuns(score.score) : undefined },
          { label: "Questions answered", value: `${score.answered} / ${score.total} (${pct(score.completeness)})` },
        ],
      },
      {
        type: "para" as const,
        style: "small" as const,
        text: "Scores are weighted by each question's policy impact and reflect only answered questions. Questions answered shows how much of the assessment this country has filled in.",
      },
      {
        type: "bars" as const,
        title: "Score and questions answered, by policy area",
        legend: { primary: "Score", secondary: "Questions answered" },
        rows: sectionRows.map(({ section, s }) => ({
          label: section.title,
          value: s.ranked ? s.score : null,
          display: scoreText(s),
          color: TEAL,
          secondary: { value: s.completeness, display: pct(s.completeness), color: AMBER },
        })),
        alt: `Score and questions answered by policy area: ${sectionRows.map(({ section, s }) => `${section.title}, score ${scoreText(s)}, ${pct(s.completeness)} of questions answered`).join("; ")}. N/A means there is not yet enough evidence for that area.`,
      },
    ],
  };

  const summary: ReportPage = {
    blocks: [
      { type: "heading" as const, text: "Summary of policy environment" },
      {
        type: "table" as const,
        head: ["Section", "Score", "Questions answered"],
        rows: sectionRows.map(({ section, s }) => [section.title, scoreText(s), pct(s.completeness)]),
        widths: [0.6, 0.15, 0.25],
        alignRight: [1, 2],
      },
    ],
  };

  const pages: ReportPage[] = [cover, summary];

  if (data.compareEntries.length > 0) {
    const columns = [
      { name: countryName, sections: data.sectionScores },
      ...data.compareEntries.map((e) => ({ name: e.name, sections: e.sections })),
    ];
    const byCol = columns.map((c) => new Map(c.sections.map(({ section, score: s }) => [section.id, s])));
    const n = columns.length;
    pages.push({
      blocks: [
        { type: "heading" as const, text: "Compare" },
        {
          type: "para" as const,
          text: `Score by section - ${countryName} against ${data.compareEntries.length} other jurisdiction${data.compareEntries.length === 1 ? "" : "s"} selected for comparison.`,
        },
        {
          type: "table" as const,
          caption: "Score by policy area for each jurisdiction compared",
          head: ["Section", ...columns.map((c) => c.name)],
          rows: data.sections.map((section) => [
            section.title,
            ...byCol.map((m) => {
              const s = m.get(section.id);
              return s ? scoreText(s) : "N/A";
            }),
          ]),
          widths: [0.4, ...Array(n).fill(0.6 / n)],
          alignRight: columns.map((_, i) => i + 1),
        },
      ],
    });
  }

  const wins = data.impact.slice(0, WINS_LIMIT);
  if (wins.length > 0) {
    const bySection = new Map<string, ImpactItem[]>();
    for (const item of wins) bySection.set(item.section.id, [...(bySection.get(item.section.id) ?? []), item]);

    // Who already does better, and can show how: exemplars from this section's pool who answered this question
    // with a higher tier and a complete citation (a title and a source), as in the live exemplar boxes.
    const exemplarsFor = (item: ImpactItem): string => {
      const better = (data.exemplars[item.section.id] ?? []).filter((ex) => {
        const r = ex.byQuestion.get(item.question.id);
        return (
          r !== undefined &&
          r.score > item.currentScore &&
          r.evidence.length > 0 &&
          r.evidence.every((e) => e.title.trim() !== "" && e.source.trim() !== "")
        );
      });
      if (better.length === 0) return "-";
      const shown = better.slice(0, EXEMPLAR_LIMIT).map((ex) => ex.name);
      return better.length > EXEMPLAR_LIMIT ? `${shown.join(", ")} +${better.length - EXEMPLAR_LIMIT} more` : shown.join(", ");
    };

    pages.push({
      blocks: [
        { type: "heading" as const, text: "Biggest policy wins" },
        { type: "para" as const, text: "Biggest policy wins based on policy score and evidence provided. Exemplars are jurisdictions that already do better on that question." },
        ...[...bySection.values()].map((items) => ({
          type: "table" as const,
          caption: items[0].section.title,
          head: ["Question", "Currently", "Exemplars", "Impact"],
          rows: items.map((item) => [
            item.question.text,
            answerLabel(item.question, { score: item.currentScore } as Response),
            exemplarsFor(item),
            impactLabel(item.question.weight),
          ]),
          widths: [0.42, 0.24, 0.22, 0.12],
        })),
      ],
    });
  }

  pages.push({
    blocks: [
      { type: "heading" as const, text: "Detail" },
      ...data.sections.flatMap((section) => {
        const qs = data.questions.filter((q) => q.sectionId === section.id).sort((a, b) => a.order - b.order);
        return [
          { type: "heading" as const, text: section.title },
          {
            type: "list" as const,
            items: qs.map((q, i) => {
              const r = data.byQuestion.get(q.id);
              // The score line is bold and in the brand colour so it stands out from the answer and evidence.
              const lines: { text: string; emphasis?: boolean }[] = [];
              if (scoreLine(q, r)) lines.push({ text: `Score: ${scoreLine(q, r)}`, emphasis: true });
              lines.push({ text: `Answer: ${answerLabel(q, r)}.` });
              if (evidenceText(r)) lines.push({ text: `Evidence: ${evidenceText(r)}.` });
              for (const e of data.compareEntries) {
                const cr = e.byQuestion.get(q.id);
                lines.push({ text: `Answer for ${e.name}: ${answerLabel(q, cr)}.` });
                if (scoreLine(q, cr)) lines.push({ text: `Score for ${e.name}: ${scoreLine(q, cr)}`, emphasis: true });
                if (evidenceText(cr)) lines.push({ text: `Evidence: ${evidenceText(cr)}.` });
              }
              // `text` carries the same words for anything that only reads plain text (tests, summaries).
              return { lead: `Question ${i + 1}: ${q.text}`, text: lines.map((l) => l.text).join("\n"), lines };
            }),
          },
        ];
      }),
    ],
  });

  return {
    title: "Solar Policy Explorer",
    documentTitle: `Policy assessment report: ${countryName}`,
    lang: "en-GB",
    pages,
    footer: `Solar Policy Explorer - ${countryName} - ${data.generatedOn}`,
    pageOf: (n, total) => `Page ${n} of ${total}`,
    logoAlt: "Global Solar Council",
    brand: BRAND,
  };
}

/** "Solar Policy Explorer - Japan - 202610151630.pdf" - the same pattern the old report used. */
export function policyReportFileName(countryName: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `Solar Policy Explorer - ${countryName} - ${stamp}.pdf`;
}

export function policyReportDate(now = new Date()): string {
  return now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
