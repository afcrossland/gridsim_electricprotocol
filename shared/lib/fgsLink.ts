/**
 * Deep links into the Future Grid Simulator (gridsim-frontend). FGS stays a
 * fully separate site - this is only a URL builder, no data or code shared.
 *
 * FGS understands `?country=CODE` (opens straight onto that region, implies
 * skipIntro) and `?skipIntro=1`. Codes it doesn't recognise are ignored there
 * (the intro just shows), so an unmapped country falls back to the plain
 * homepage here instead of sending a code that does nothing.
 */
export const FGS_URL = "https://futuregridsimulator.globalsolarcouncil.org/";

/**
 * Jurisdiction codes that differ from FGS's region code. Only the one-to-one
 * renames live here; countries FGS splits into several regions (US, BR, CA,
 * JP, AU) are deliberately absent - no single region stands for the country.
 */
const FGS_CODE_OVERRIDES: Record<string, string> = {
  MY: "MY1",
};

/**
 * ISO country codes FGS has a region for, as of FGS's `countriesWithData`
 * (gridsim-frontend/gsc_energymap/src/data/grids.tsx). ME/MK/LT are
 * temporarily hidden in FGS and so left out. Update when FGS adds a region.
 */
const FGS_COUNTRIES = new Set([
  "IN", "LK", "BD", "KR", "PH", "MY1", "PK",
  "AT", "BA", "BE", "BG", "CH", "CZ", "DE", "DK", "EE", "ES", "FR", "GR",
  "HR", "HU", "IE", "IT", "LU", "LV", "NL", "NO", "PL", "PT", "RO", "RS",
  "SE", "SI", "SK", "TR", "MX", "ZA", "CL", "NZ",
]);

/** FGS's code for this jurisdiction, or null when FGS has no matching region. */
export function fgsCodeFor(jurisdictionCode: string): string | null {
  const code = FGS_CODE_OVERRIDES[jurisdictionCode] ?? jurisdictionCode;
  return FGS_COUNTRIES.has(code) ? code : null;
}

/** Deep link to the country in FGS, or the FGS homepage when it has none. */
export function fgsUrlFor(jurisdictionCode: string): string {
  const code = fgsCodeFor(jurisdictionCode);
  return code ? `${FGS_URL}?country=${encodeURIComponent(code)}&skipIntro=1` : FGS_URL;
}
