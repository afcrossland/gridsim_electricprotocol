import { initI18n, withSharedStrings } from "../../../shared/i18n/init";
import enCommon from "./locales/en/common.json";
import esCommon from "./locales/es/common.json";
import frCommon from "./locales/fr/common.json";

// ─── Localisation setup ────────────────────────────────────────────────────
// Same pattern as ep_policymap's own src/i18n/index.ts (adopted from the
// sibling gridsim-frontend project's setup) - kept as a separate copy
// rather than shared code, matching how every other concept these two apps
// have in common (CountrySearch/JurisdictionSearch, EmberBadge,
// LanguageSwitcher itself) is already duplicated per-app rather than
// imported cross-tree. Added 2026-09-11; converted content is essentially
// everything in this app (see the root README.md's "Localization" section
// for the full list and the mechanisms involved).
//
// `SUPPORTED_LANGUAGES` is only `["en"]` right now - es/fr are fully
// translated and still loaded below in `resources`, just not offered in
// LanguageSwitcher.tsx's menu, per Andrew's instruction 2026-09-11 (turn
// the options off without losing the work). Add "es"/"fr" back here (and
// to LanguageSwitcher.tsx's LANGUAGE_LABELS, already present) to re-enable
// either with no other changes needed.
export const SUPPORTED_LANGUAGES = ["en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

/** localStorage key a returning visitor's language choice is saved under - see main.tsx and LanguageSwitcher.tsx. */
export const LANGUAGE_KEY = "deployment-language";

// The continent and sub-region names are shared with the other apps (shared/i18n), merged in here.
export const resources = withSharedStrings({
  en: { common: enCommon },
  es: { common: esCommon },
  fr: { common: frCommon },
});

const i18n = initI18n(resources, DEFAULT_LANGUAGE);

export default i18n;
