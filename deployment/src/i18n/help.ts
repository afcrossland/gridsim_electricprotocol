import helpContentEn from "../data/help-content.json";
import helpContentEs from "../data/help-content.es.json";
import helpContentFr from "../data/help-content.fr.json";
import { DEFAULT_LANGUAGE } from "./index";

/** A run of text within a paragraph or list item - `bold`/`href` let one run carry emphasis or link out, matching what the old hand-written JSX expressed inline. */
export interface HelpRun {
  text: string;
  bold?: boolean;
  href?: string;
}

export type HelpBlock =
  | { type: "paragraph"; runs: HelpRun[] }
  | { type: "list"; items: HelpRun[][] }
  | { type: "formula"; text: string };

export interface HelpSection {
  heading: string;
  blocks: HelpBlock[];
}

// This app's Help content mixes bullet lists, bold terms, inline links and
// a formula line (unlike ep_policymap's own, plain heading/body topics), so
// it needs richer structured JSON than that app's help-content.json shape -
// a HelpRun array per paragraph/list item rather than a single string, so
// HelpPage.tsx can render bold/links without any markdown parsing. Same
// underlying idea as the sibling gridsim-frontend project's own
// src/i18n/help.ts though: structured per-language JSON, not flat
// translation keys, loaded through one getHelpContent(language) lookup.
// To localise: add help-content.<lng>.json and register it below.
const HELP_CONTENT: Record<string, HelpSection[]> = {
  en: helpContentEn as HelpSection[],
  es: helpContentEs as HelpSection[],
  fr: helpContentFr as HelpSection[],
};

/** Structured Help content for the given language, falling back to the default. */
export function getHelpContent(language: string): HelpSection[] {
  const base = language.split("-")[0];
  return HELP_CONTENT[language] ?? HELP_CONTENT[base] ?? HELP_CONTENT[DEFAULT_LANGUAGE];
}
