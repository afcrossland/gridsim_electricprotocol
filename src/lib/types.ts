export interface RubricTier {
  score: number;
  label: string;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  sourceRow?: number;
}

export interface Question {
  id: string;
  sectionId: string;
  subsection: string | null;
  order: number;
  text: string;
  weight: number;
  rubric: RubricTier[];
  sourceRow?: number;
  seedAnswers?: Record<string, number>;
}

/** One country's response to one question. */
export interface Response {
  questionId: string;
  countryCode: string;
  score: number;
  /** Supporting citation — a URL, statute reference or document name. */
  source: string;
  /** Free-text justification for the chosen score. */
  note: string;
  updatedAt: string;
  /** Seeded from the spreadsheet or from researched data, not entered in the app. */
  seeded?: boolean;
  /**
   * How far the evidence goes. "national" cites something specific to this
   * country; "directive-baseline" cites an EU instrument that creates the right
   * without confirming this country transposed it.
   */
  basis?: "national" | "directive-baseline" | "proxy-indicator";
}

export interface Protocol {
  title: string;
  maxScore: number;
  completenessThreshold: number;
  glossary: string[];
  sections: Section[];
  countries: { code: string; name: string }[];
  questions: Question[];
}

export type Role = "registered" | "admin";

/** A country's computed standing. */
export interface CountryScore {
  code: string;
  name: string;
  /** Weighted score over answered questions only, 0..1. */
  score: number;
  /** Share of total question weight that has been answered, 0..1. */
  completeness: number;
  answered: number;
  total: number;
  /** False when completeness is below the protocol threshold. */
  ranked: boolean;
}

/** A single unanswered-or-improvable question, ranked by what it would gain. */
export interface ImpactItem {
  question: Question;
  section: Section;
  currentScore: number | null;
  /** weight x (maxScore - currentScore) — raw points available. */
  gain: number;
  /** Percentage points added to the country score if taken to full marks. */
  scoreDelta: number;
}
