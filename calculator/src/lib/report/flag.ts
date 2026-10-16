/**
 * The country flag as PNG bytes for the report cover, from the same flagcdn service the app already loads its on-screen
 * flags from (shared/components/FlagImg.tsx). Returns null if it cannot be fetched (offline, or no flag for that
 * code) - the report is made without it rather than failing.
 */
export async function fetchFlagPng(countryCode: string): Promise<Uint8Array | null> {
  if (!/^[a-z]{2}$/i.test(countryCode)) return null;
  try {
    const res = await fetch(`https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
