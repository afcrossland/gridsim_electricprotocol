/**
 * Rubric answer labels came in from the source spreadsheet with inconsistent
 * capitalisation - some start mid-sentence, some already have a capital.
 * Every place a rubric label is shown to a reader runs it through this
 * rather than fixing it at the data layer, so a future re-import or admin
 * edit can't silently reintroduce the inconsistency.
 */
export function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
