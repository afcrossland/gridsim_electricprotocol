import helpContentEn from "../data/help-content.json";
import helpContentEs from "../data/help-content.es.json";
import helpContentFr from "../data/help-content.fr.json";
import { DEFAULT_LANGUAGE } from "./index";

// The Help page's topic list is longer, structured prose rather than short
// chrome labels, so it lives as per-language structured JSON (same
// reasoning as the sibling gridsim-frontend project's own src/i18n/help.ts)
// rather than as flat i18next keys. To localise: add
// help-content.<lng>.json and register it below.
//
// The Citizens Electrification Charter block also shown on this page
// (src/data/charter.ts, also used by WelcomeModal.tsx) is NOT translated
// here - it's shared with a component outside this pass's scope, so it
// stays English until that's converted too, rather than translating it in
// one place and not the other.
const HELP_CONTENT: Record<string, typeof helpContentEn> = {
  en: helpContentEn,
  es: helpContentEs,
  fr: helpContentFr,
};

/** Structured Help content for the given language, falling back to the default. */
export function getHelpContent(language: string): typeof helpContentEn {
  const base = language.split("-")[0];
  return HELP_CONTENT[language] ?? HELP_CONTENT[base] ?? HELP_CONTENT[DEFAULT_LANGUAGE];
}
