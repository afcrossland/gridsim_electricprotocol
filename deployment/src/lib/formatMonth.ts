/**
 * One cached Intl.DateTimeFormat per language, same reasoning as
 * lib/jurisdictions.ts's regionDisplayNamesCache - building a formatter
 * isn't free.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * A 1-12 month number as a short, localised abbreviation ("Aug", "ago",
 * "août") - via the browser's own Intl data, same "no translation file to
 * maintain" approach as jurisdiction names. Replaces the old hardcoded
 * English `MONTHS` array in TotalCapacityTile.tsx/CountryDetail.tsx.
 */
export function monthAbbrev(month: number, language: string): string {
  let formatter = formatterCache.get(language);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language, { month: "short" });
    formatterCache.set(language, formatter);
  }
  return formatter.format(new Date(2000, month - 1, 1));
}
