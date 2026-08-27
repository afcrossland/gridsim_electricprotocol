/**
 * A jurisdiction's detail view has three tabs - Summary, Policy Wins, and
 * Policy Landscape. Lives here, not in CountryPanel
 * itself, so the protocol store can reference the type/default without a
 * circular import (the store also needs CountryPanel's own
 * useProtocolStore hook).
 */
export const IMPACT = "impact";
export const SECTIONS = "sections";
export const WINDROSE = "windrose";
export type CountryPanelTab = typeof IMPACT | typeof SECTIONS | typeof WINDROSE;

export interface RubricTier {
  /** Stable id for this tier, also what a Response.score points at - not required to be contiguous. */
  score: number;
  label: string;
  /** How much this tier counts toward the weighted score, 0-4. Editable in the admin console. */
  points: number;
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

/** One citation supporting a Response's score - a question can rest on more than one. */
export interface EvidenceItem {
  /** Short name for the source - "EU RED II, Article 21", "IEX market rules". */
  title: string;
  /** A URL, statute reference or document name. */
  source: string;
  /** Free-text justification, specific to this one piece of evidence. */
  note: string;
}

/** One country's response to one question. */
export interface Response {
  questionId: string;
  countryCode: string;
  score: number;
  /** Zero or more citations supporting this score - a bare score with none is still a valid response. */
  evidence: EvidenceItem[];
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

/**
 * A scoreboard row - either one country standing alone, or a country grouped
 * with its subnational jurisdictions.
 *
 * Two different shapes of "group" exist and this covers both:
 *
 * - A subdivided country (Australia, the US, Canada) has no shape or score of
 *   its own; `score` is the average across whichever children are `ranked`,
 *   and is meaningless (0, `ranked: false`) if none are.
 * - A country with exclaves but its own shape (France) keeps its own `score`
 *   as the row's score; the exclaves are additional children shown in the
 *   breakdown, not averaged in.
 */
export interface GroupedScore {
  code: string;
  name: string;
  isGroup: boolean;
  /** Populated only when isGroup is true. */
  children: CountryScore[];
  score: number;
  completeness: number;
  ranked: boolean;
  /** For a group with no score of its own: how many children are ranked. */
  rankedChildren: number;
  totalChildren: number;
  /**
   * True for France-shaped groups (a real, directly-evidenced score at the
   * anchor code, with exclave children shown alongside it). False for
   * Australia-shaped groups (no shape or score of its own; `score` above is
   * synthesised entirely from `children`). Governs whether clicking the row
   * opens the anchor's own country page or only expands the child list.
   */
  hasOwnScore: boolean;
}

/** A single unanswered-or-improvable question, ranked by what it would gain. */
export interface ImpactItem {
  question: Question;
  section: Section;
  /** Raw rubric tier (0/1/2), always answered - rankImpact excludes unanswered questions entirely. */
  currentScore: number;
  /** weight x (points available at the top tier - points earned now) - see tierPoints() in scoring.ts. */
  gain: number;
  /** Percentage points added to the country score if taken to full marks. */
  scoreDelta: number;
}
