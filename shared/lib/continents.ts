/**
 * Continent list + UN sub-region lookup for a "filter by continent" control -
 * confirmed byte-identical between policy's and deployment's own
 * `lib/jurisdictions.ts` (deployment's own doc comment says it was "ported
 * from ep_policymap's own... same reasoning there applies here") before this
 * shared copy was written 2026-09-28. Each app still resolves its own
 * jurisdiction code to a region string its own way (policy's own
 * `continentOf` additionally walks up to a subnational code's parent, which
 * deployment's simpler version never needs to since it has no subdivided
 * countries) - only the region->continent table and the short display list
 * are the same across all three, so only those live here.
 */
export const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"] as const;

export type Continent = (typeof CONTINENTS)[number];

/**
 * UN sub-region -> continent. Coarser than a jurisdiction's own `region`
 * field (which has ~20 values) so the filter is a short, ordinary list
 * rather than a near-duplicate of a country dropdown next to it.
 *
 * Antarctica is deliberately left unmapped - it is never a jurisdiction any
 * of the three apps would offer to filter to. The handful of remote,
 * uninhabited "Seven seas (open ocean)" territories (South Georgia, Heard
 * Island, etc.) are also left unmapped for the same reason.
 */
const CONTINENT_BY_REGION: Record<string, Continent> = {
  "Northern Africa": "Africa",
  "Eastern Africa": "Africa",
  "Middle Africa": "Africa",
  "Southern Africa": "Africa",
  "Western Africa": "Africa",
  "Central Asia": "Asia",
  "Eastern Asia": "Asia",
  "South-Eastern Asia": "Asia",
  "Southern Asia": "Asia",
  "Western Asia": "Asia",
  "Eastern Europe": "Europe",
  "Northern Europe": "Europe",
  "Southern Europe": "Europe",
  "Western Europe": "Europe",
  Caribbean: "North America",
  "Central America": "North America",
  "Northern America": "North America",
  "South America": "South America",
  "Australia and New Zealand": "Oceania",
  Melanesia: "Oceania",
  Micronesia: "Oceania",
  Polynesia: "Oceania",
};

/** A UN sub-region string (a jurisdiction's own `region` field) -> its continent, for filtering. */
export function continentOfRegion(region: string | null | undefined): Continent | null {
  if (!region) return null;
  return CONTINENT_BY_REGION[region] ?? null;
}

/**
 * The UN geoscheme's own 22 sub-regions (https://en.wikipedia.org/wiki/
 * United_Nations_geoscheme) - `CONTINENT_BY_REGION`'s own keys, in the same
 * grouped-by-continent order, exported directly rather than re-declared so
 * the two can never drift apart. Deployment's own continent filter switched
 * to this finer list 2026-10-14 per Andrew's own instruction ("implement a
 * filter not on continent but on United Nations geoscheme") - the six-
 * continent `CONTINENTS` list above stays as the default for policy's and
 * calculator's own filters, which this doesn't change.
 */
export const SUBREGIONS = Object.keys(CONTINENT_BY_REGION);

/**
 * A handful of overseas territories whose own jurisdiction record has no
 * `region` of its own and inherits its *parent* country's instead (see each
 * app's own `lib/jurisdictions.ts` - a subnational jurisdiction's `region`
 * field holds its parent's name, not a UN sub-region, so continent lookup
 * walks up to the parent's own region) - correct for an ordinary state or
 * province, but wrong for a distant exclave whose European parent's own
 * continent isn't where the territory actually is. Found 2026-09-28 when
 * Bonaire/Sint Eustatius/Saba (Dutch Caribbean municipalities) came back as
 * "Europe" via the Netherlands' own "Western Europe" region. Checked by
 * jurisdiction code, before the ordinary parent-walk lookup.
 *
 * Only the cases where this actually happens: France's own overseas
 * exclaves (`EXCLAVES` in `scripts/build_geometry.py`) and Bonaire/Sint
 * Eustatius/Saba. The Canary Islands (Spain) and Svalbard/Jan Mayen
 * (Norway) are NOT overridden - both are conventionally counted as part of
 * their European parent's own continent in a list like this one, unlike a
 * Caribbean or South American or Indian Ocean territory.
 */
const CONTINENT_OVERRIDE_BY_CODE: Record<string, Continent> = {
  BQ: "North America", // Bonaire, Sint Eustatius and Saba - Caribbean
  "FR-GF": "South America", // French Guiana
  "FR-GP": "North America", // Guadeloupe - Caribbean
  "FR-MQ": "North America", // Martinique - Caribbean
  "FR-RE": "Africa", // Réunion - Indian Ocean, off East Africa
  "FR-YT": "Africa", // Mayotte - Indian Ocean, off East Africa
};

/** Checked before the ordinary parent-walk continent lookup - see `CONTINENT_OVERRIDE_BY_CODE`'s own doc comment. */
export function continentOverrideFor(code: string): Continent | null {
  return CONTINENT_OVERRIDE_BY_CODE[code] ?? null;
}

/**
 * Same fix as `CONTINENT_OVERRIDE_BY_CODE`, one level finer - these six
 * codes' own inherited `region` (their parent's, not their own) is wrong
 * at the sub-region grain too, not just the continent one, so sub-region
 * lookup needs its own override map rather than reusing the continent
 * one's values (a continent name isn't a valid sub-region).
 */
const SUBREGION_OVERRIDE_BY_CODE: Record<string, string> = {
  BQ: "Caribbean", // Bonaire, Sint Eustatius and Saba
  "FR-GF": "South America", // French Guiana
  "FR-GP": "Caribbean", // Guadeloupe
  "FR-MQ": "Caribbean", // Martinique
  "FR-RE": "Eastern Africa", // Réunion
  "FR-YT": "Eastern Africa", // Mayotte
};

/** Checked before the ordinary parent-walk sub-region lookup - see `SUBREGION_OVERRIDE_BY_CODE`'s own doc comment. */
export function subregionOverrideFor(code: string): string | null {
  return SUBREGION_OVERRIDE_BY_CODE[code] ?? null;
}
