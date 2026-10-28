import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enRegions from "./regions.en.json";
import esRegions from "./regions.es.json";
import frRegions from "./regions.fr.json";

type Strings = Record<string, unknown>;

/**
 * Strings every app shares: the continent and UN sub-region names the region filter shows (`continents.*`,
 * `subregions.*`). They live here once (they used to be copied into each app's own `common.json`) and are merged into
 * each app's own strings by `withSharedStrings`.
 */
const SHARED: Record<string, Strings> = { en: enRegions, es: esRegions, fr: frRegions };

/** Adds the shared strings to each language's own `common` strings. */
export function withSharedStrings<T extends Record<string, { common: Strings }>>(resources: T): T {
  const merged: Record<string, { common: Strings }> = {};
  for (const [lng, ns] of Object.entries(resources)) {
    merged[lng] = { common: { ...ns.common, ...(SHARED[lng] ?? {}) } };
  }
  return merged as T;
}

/** The one i18next setup the apps use: a single `common` namespace, English by default, no double escaping. */
export function initI18n(resources: Record<string, { common: Strings }>, defaultLanguage: string): typeof i18n {
  i18n.use(initReactI18next).init({
    resources,
    lng: defaultLanguage,
    fallbackLng: defaultLanguage,
    ns: ["common"],
    defaultNS: "common",
    interpolation: {
      // React already escapes output, so i18next must not double-escape.
      escapeValue: false,
    },
    returnNull: false,
  });
  return i18n;
}
