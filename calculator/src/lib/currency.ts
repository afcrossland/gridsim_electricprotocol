const EUROZONE = new Set([
  "at", "be", "cy", "ee", "fi", "fr", "de", "gr", "ie", "it", "lv", "lt", "lu", "mt", "nl", "pt", "sk", "si", "es", "hr",
]);

const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string }> = {
  us: { code: "USD", symbol: "US$" },
  ca: { code: "CAD", symbol: "C$" },
  au: { code: "AUD", symbol: "A$" },
  nz: { code: "NZD", symbol: "NZ$" },
  gb: { code: "GBP", symbol: "£" },
};

/**
 * Per Andrew's own instruction 2026-09-17 ("use USD in USA, CAD, AUD, NZD,
 * EUR, GBP and where not use USD as default"): the tariff sliders' own unit
 * switches to the visitor's local currency for these six, everywhere else
 * stays USD. This is a display-symbol swap only, not real currency
 * conversion - the numeric defaults (`DEFAULT_TARIFFS`) are the same
 * figures regardless of which symbol they're shown against, matching this
 * app's existing placeholder-economics stance (see `payback.ts`'s own
 * install-cost estimate).
 */
export function currencyUnit(countryCode: string | undefined): string {
  const cc = countryCode?.toLowerCase();
  if (cc && EUROZONE.has(cc)) return "€/kWh";
  if (cc && cc in COUNTRY_CURRENCY) return `${COUNTRY_CURRENCY[cc].symbol}/kWh`;
  return "US$/kWh";
}
