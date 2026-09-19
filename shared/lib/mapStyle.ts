import type { StyleSpecification } from "react-map-gl/maplibre";

import mapStyleJsonLight from "../assets/map_gsc.json";
import mapStyleJsonDark from "../assets/map_gsc_dark.json";

/**
 * Loads the shared GSC MapLibre style (light or dark) with the visitor's
 * own `VITE_MAPTILER_KEY` substituted into the `maptiler_planet_v4`
 * source URL and `style.glyphs` - the exact load-and-patch logic that was
 * duplicated identically across all three apps' own map components
 * (`WorldMap.tsx`/`DeploymentMap.tsx`/`PolicyMap.tsx`) before this shared
 * `shared/` directory existed (2026-09-19). `structuredClone` first since
 * the imported JSON module is a shared singleton object - mutating it
 * in place would leak the substituted key (or a previous render's) into
 * every future call.
 *
 * `map_gsc.json`/`map_gsc_dark.json` themselves are byte-identical to the
 * three apps' own per-app copies (confirmed via `md5` before this file was
 * written) - this is the one shared copy going forward for anything newly
 * built against `shared/`; the three existing per-app copies stay in
 * place until each app is actually ported over (not done yet - see
 * ROADMAP.md).
 */
export function loadMapStyle(mode: "light" | "dark"): StyleSpecification {
  const base = mode === "dark" ? mapStyleJsonDark : mapStyleJsonLight;
  const style = structuredClone(base) as { sources: Record<string, { url?: string }>; glyphs?: string };
  const key = import.meta.env.VITE_MAPTILER_KEY;
  const source = style.sources?.maptiler_planet_v4;
  if (source?.url) source.url = source.url.replace("placeholder", key);
  if (style.glyphs) style.glyphs = style.glyphs.replace("placeholder", key);
  return style as unknown as StyleSpecification;
}
