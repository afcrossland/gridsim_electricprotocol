import charterEn from "../data/charter.json";
import charterEs from "../data/charter.es.json";
import charterFr from "../data/charter.fr.json";
import { DEFAULT_LANGUAGE } from "./index";

// The Citizens Electrification Charter is long, structured prose (an
// intro of paragraphs, then three named rights), so it lives as
// per-language structured JSON rather than flat i18next keys - same
// reasoning as help.ts. Replaces the old plain `CHARTER` export from
// src/data/charter.ts (English-only, shared unmodified by HelpPage.tsx and
// WelcomeModal.tsx) - both now read getCharter(i18n.language) instead.
const CHARTER: Record<string, typeof charterEn> = {
  en: charterEn,
  es: charterEs,
  fr: charterFr,
};

/** The Charter's content for the given language, falling back to the default. */
export function getCharter(language: string): typeof charterEn {
  const base = language.split("-")[0];
  return CHARTER[language] ?? CHARTER[base] ?? CHARTER[DEFAULT_LANGUAGE];
}
