import { resolveTargets } from "../lib/jurisdictions";
import type { Question, Response } from "../lib/types";
import raw from "./sourced-answers.json";
import indicatorRaw from "./indicator-answers.json";

interface SourceRef {
  title: string;
  url: string;
  /**
   * How authoritative the source itself is - independent of `basis`, which
   * says how specifically an *answer* targets a jurisdiction. A source is
   * "primary-official" when it is the regulator, market operator, statute
   * text or other official body's own material (need not be a literal .gov
   * domain - a market operator like the Indian Energy Exchange counts); it is
   * "secondary" when it is a news article, law firm briefing or explainer
   * site describing that material rather than being it. Optional and not
   * backfilled onto sources added before this field existed - see
   * `sourcedAnswers.test.ts` for what is and is not enforced.
   */
  quality?: "primary-official" | "secondary";
}

interface AnswerEntry {
  /** Either a named group of jurisdictions, or an explicit list. */
  group?: string;
  countries?: string[];
  /** Row in the source spreadsheet, which is how questions are identified here. */
  row: number;
  score: number;
  basis: "national" | "directive-baseline" | "proxy-indicator";
  sourceId: string;
  note: string;
}

interface SourcedAnswers {
  sources: Record<string, SourceRef>;
  groups: Record<string, string[]>;
  answers: AnswerEntry[];
}

const handWritten = raw as unknown as SourcedAnswers;
const indicators = indicatorRaw as unknown as SourcedAnswers;

/**
 * Both files share a schema. Indicator answers are listed first so that a
 * hand-written answer covering the same ground wins - see BASIS_RANK.
 */
const data: SourcedAnswers = {
  sources: { ...indicators.sources, ...handWritten.sources },
  groups: { ...indicators.groups, ...handWritten.groups },
  answers: [...indicators.answers, ...handWritten.answers],
};

/**
 * How much an answer is worth believing, used to break ties when two answers
 * address the same jurisdiction at the same specificity. Researched national
 * evidence beats an EU-wide baseline, which beats a statistical proxy.
 */
const BASIS_RANK: Record<AnswerEntry["basis"], number> = {
  "proxy-indicator": 0,
  "directive-baseline": 1,
  national: 2,
};

/**
 * How specifically an answer was addressed to a jurisdiction. When two answers
 * cover the same jurisdiction and question, the more specific one wins - so a
 * South Australia answer overrides a NEM-wide one, which overrides an
 * Australia-wide one.
 */
const SPECIFICITY = {
  /** Written against a country and pushed down to its states. */
  inherited: 1,
  /** Written against a named group. */
  group: 2,
  /** Written against this exact jurisdiction. */
  exact: 3,
} as const;

/**
 * Expand the researched answers into responses.
 *
 * Entries are keyed by spreadsheet row rather than question id so that a
 * reviewer can check any one of them against the sheet directly. Rows that no
 * longer exist - row 44 was dropped as a duplicate at import - are skipped
 * rather than silently attached to the wrong question.
 */
export function sourcedResponses(questions: Question[]): Response[] {
  const byRow = new Map(questions.filter((q) => q.sourceRow).map((q) => [q.sourceRow!, q]));

  // questionId -> jurisdiction -> winning answer so far
  const winners = new Map<
    string,
    Map<string, { response: Response; specificity: number; basisRank: number }>
  >();

  for (const entry of data.answers) {
    const question = byRow.get(entry.row);
    if (!question) {
      console.warn(`sourced answer references unknown spreadsheet row ${entry.row}`);
      continue;
    }

    const source = data.sources[entry.sourceId];
    if (!source) {
      console.warn(`sourced answer references unknown source ${entry.sourceId}`);
      continue;
    }

    const targets = entry.countries ?? data.groups[entry.group ?? ""] ?? [];
    if (targets.length === 0) {
      console.warn(`sourced answer for row ${entry.row} matched no jurisdictions`);
      continue;
    }

    const note =
      entry.basis === "directive-baseline"
        ? `${entry.note}\n\nEU directive baseline - national transposition has not been individually verified for this country.`
        : entry.note;

    for (const target of targets) {
      const resolved = resolveTargets(target);
      const inherited = resolved.length !== 1 || resolved[0] !== target;
      const specificity = inherited
        ? SPECIFICITY.inherited
        : entry.group
          ? SPECIFICITY.group
          : SPECIFICITY.exact;

      for (const code of resolved) {
        const forQuestion = winners.get(question.id) ?? new Map();
        winners.set(question.id, forQuestion);

        const basisRank = BASIS_RANK[entry.basis];
        const existing = forQuestion.get(code);
        if (existing) {
          if (existing.specificity > specificity) continue;
          if (existing.specificity === specificity) {
            if (existing.basisRank > basisRank) continue;
            if (existing.basisRank === basisRank) {
              console.warn(
                `conflicting answers for ${code} on spreadsheet row ${entry.row} ` +
                  "at equal specificity and evidence basis",
              );
              continue;
            }
          }
        }

        forQuestion.set(code, {
          specificity,
          basisRank,
          response: {
            questionId: question.id,
            countryCode: code,
            score: entry.score,
            source: `${source.title} - ${source.url}`,
            note: inherited
              ? `${note}\n\nInherited from the ${target} answer; not written specifically for this jurisdiction.`
              : note,
            updatedAt: new Date(0).toISOString(),
            seeded: true,
            basis: entry.basis,
          },
        });
      }
    }
  }

  return [...winners.values()].flatMap((forQuestion) =>
    [...forQuestion.values()].map((w) => w.response),
  );
}

/** Jurisdictions that the researched answers cover, for seeding the scoreboard. */
export function sourcedCountries(): string[] {
  const codes = new Set<string>();
  for (const entry of data.answers) {
    for (const target of entry.countries ?? data.groups[entry.group ?? ""] ?? []) {
      for (const code of resolveTargets(target)) codes.add(code);
    }
  }
  return [...codes];
}

/**
 * The EU-27 member codes, for the scoreboard's EU rollup row - re-exported
 * from the same list `sourced-answers.json`'s "EU27" group already uses to
 * address answers, so scoreboard grouping and answer targeting can never
 * silently drift onto different membership lists.
 */
export const EU27: readonly string[] = data.groups.EU27 ?? [];
