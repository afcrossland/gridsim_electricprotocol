import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import esCommon from "./locales/es/common.json";
import frCommon from "./locales/fr/common.json";

// ─── Localisation setup ────────────────────────────────────────────────────
// Same pattern as the sibling gridsim-frontend project's own
// src/i18n/index.ts - all user-facing copy lives in
// src/i18n/locales/<lng>/<namespace>.json, read through react-i18next's
// `useTranslation(namespace)` hook. Added 2026-09-11; converted content is
// essentially everything except the PDF report (see README.md's
// "Localization" section for the exact list and the mechanisms involved -
// jurisdiction names, the Charter, the scroll-story tours, etc.).
//
// `SUPPORTED_LANGUAGES` is only `["en"]` right now - es/fr are fully
// translated and still loaded below in `resources`, just not offered in
// LanguageSwitcher.tsx's menu, per Andrew's instruction 2026-09-11 (turn
// the options off without losing the work) - same "translated but not
// switched on yet" state gridsim-frontend's own project keeps most of its
// 14 languages in. Add "es"/"fr" back here (and to
// LanguageSwitcher.tsx's LANGUAGE_LABELS, already present) to re-enable
// either with no other changes needed.
//
// To add a new language from scratch:
//   1. Create src/i18n/locales/<lng>/common.json with the same keys as `en`.
//   2. Add its Help content (src/i18n/help.ts) and Charter content
//      (src/i18n/charter.ts) and scroll-story text (src/i18n/scenes.ts).
//   3. Add the bundle to `resources` below and to `SUPPORTED_LANGUAGES`.
//   4. Add a native-name entry to LanguageSwitcher.tsx's LANGUAGE_LABELS.
//
// Namespaces:
//   common — nav bar, footer, theme toggle, and most of the rest of the UI
// Longer structured content (Help, the Charter, scroll-story scenes) is
// kept as its own per-language JSON instead of flat keys - see
// i18n/help.ts, i18n/charter.ts and i18n/scenes.ts for why.
export const SUPPORTED_LANGUAGES = ["en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

export const resources = {
  en: { common: enCommon },
  es: { common: esCommon },
  fr: { common: frCommon },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  ns: ["common"],
  defaultNS: "common",
  interpolation: {
    // React already escapes output, so i18next must not double-escape.
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
