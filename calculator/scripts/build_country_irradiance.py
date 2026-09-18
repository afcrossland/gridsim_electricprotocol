#!/usr/bin/env python3
"""Build src/data/country-irradiance.json - a real 8760-hour (one year,
hourly) generation profile per country, in W/Wp (watts of AC output per
watt-peak of installed capacity - multiply by a system's own Wp to get its
hourly output in W, sum/1000 for kWh).

As of 2026-09-17 this calls the **PVGIS `seriescalc` API**
(https://re.jrc.ec.europa.eu/api/v5_2/seriescalc) for each country's own
representative point - real satellite/reanalysis-derived hourly weather
(PVGIS-SARAH2/SARAH3 for Europe/Africa/most of Asia, PVGIS-NSRDB for the
Americas, PVGIS-ERA5 filling the rest), not the synthetic day-length model
this script used until Andrew noticed the earlier version "looks to be a
monthly pattern repeated over the month" (2026-09-17) - a smooth
astronomical curve has no day-to-day weather variability at all, which is
exactly what that looked like. Confirmed via direct API calls that
`seriescalc` returns genuine hour-by-hour variation (a cloudy day next to a
clear one, real temperature swings), not a repeated shape.

Per-request parameters:
- **Location**: each country's own biggest city, from Natural Earth's own
  `ne_10m_populated_places` (`biggest_city_points()` below) - added
  2026-09-18 per Andrew's own instruction ("we should calculate the
  irradiance at the location of the most populous city?"), replacing a
  plain `representative_point()` (shapely) on the country's own geometry
  in assets/jurisdictions.geojson. That geometric approach had a real
  failure mode for large, climate-diverse countries: China's own point
  landed on the Qinghai-Tibet plateau, a remote high-altitude desert with
  genuinely ~2,200 kWh/kWp/yr, nothing like what most Chinese people's own
  homes see - Shanghai, China's biggest city, is a far more representative
  single point. 225 of 234 country-level codes have a populated-places
  entry; the rest (mostly tiny territories, plus Kosovo and Nauru for less
  obvious reasons) still fall back to `representative_point()` - see
  `country_points()`'s own doc comment. Still just one point per country,
  so a country whose population is genuinely split across different
  climates isn't fully fixed by this - only less arbitrary about which
  single point it picks.
- **`pvcalculation=1`, `peakpower=1`, `loss=0`**: asks PVGIS to compute
  actual PV power output (its own `P` field, in Watts) for a 1kWp system
  with zero system losses (inverter/wiring/soiling losses aren't this
  dataset's job - `payback.ts`'s own install-cost/output assumptions are a
  separate placeholder), already tilt/azimuth-adjusted - so `P / 1000`
  is directly this dataset's own W/Wp unit.
- **`mountingplace=building`**: this app models rooftop residential solar,
  not a ground-mounted array - per Andrew's own instruction 2026-09-17
  ("remember this is rooftop solar so will be different to groundmount").
  PVGIS's `building` mounting type accounts for reduced airflow under a
  roof-mounted array (it runs hotter, so a bit less efficient) versus its
  own default `free`-standing/ground-mount assumption - confirmed via a
  direct comparison (London: ~1,174 kWh/kWp/yr free-standing vs ~1,138
  building-mounted, roughly 3% lower).
- **Fixed tilt/azimuth, this script's own former heuristic** (due
  south/north by hemisphere, tilt clamped 5-35° to the location's own
  latitude) - **not** PVGIS's own `optimalangles=1`. That was tried first
  (2026-09-17) and looked appealing - PVGIS choosing the true optimal angle
  itself, rather than this script guessing - but Andrew caught it producing
  physically-wrong numbers (Sri Lanka's own "optimal" angle came back tilt
  -1°/azimuth -132°, an invalid negative tilt, at 512 kWh/kWp/yr; the real
  figure at a sane fixed angle is ~1,630). Direct testing confirmed PVGIS's
  own optimal-angle solver is broken for near-equatorial locations - it
  doesn't error, it just returns a bad "optimal" angle with `optimal: true`
  and a correspondingly wrong yield (14+ countries were affected: negative
  tilts, and azimuths outside the normal -180/180 range like Papua New
  Guinea's own -205°, confirming this is a genuine PVGIS-side bug, not a
  plausible answer). This script's own fixed-angle heuristic isn't perfect
  either, but it's always a physically sane angle, and PVGIS's real weather
  data still drives the hourly shape - only the orientation choice
  reverted.
- **`usehorizon=0`**: PVGIS defaults to shading the calculation against the
  REAL terrain surrounding the exact lat/lon requested (elevation-derived
  horizon data), not just the panel's own tilt/azimuth. Found 2026-09-18
  when Greece's own representative point (39.0845, 21.8069 - inland, 651m,
  hilly) came back at a suspiciously low 1,043 kWh/kWp/yr, below Germany's
  own 1,209 despite being much further south; a direct PVGIS call
  confirmed `usehorizon=0` for that exact point gives 1,531, in line with
  its Mediterranean neighbours. Real local horizon shading is appropriate
  for one real address, but not for a single national representative point
  - a point that happens to land in a valley or hillside shouldn't crush
  the whole country's own figure with terrain shading specific to that one
  spot. Same underlying limitation as China's own desert point above (one
  point can't represent a country), just the opposite direction - there an
  unrepresentative point reads too high, here real terrain at an
  unrepresentative point reads too low.
- **`startyear=endyear=2015`**: PVGIS's per-location "best" radiation
  database differs (SARAH2/3, ERA5, NSRDB), and each has its own valid year
  range - confirmed by testing that PVGIS-NSRDB (the Americas) only
  supports 2005-2015, while SARAH2/ERA5 elsewhere go up to ~2020. 2015 is
  the one year confirmed to work across a spread of test locations
  (Europe/SARAH2, Australia/ERA5, Singapore/ERA5, Kenya/SARAH2,
  Iceland/SARAH2, the continental US/NSRDB) - a single specific historical
  year's real weather, not a statistically "typical" year (PVGIS's own
  `tmy` endpoint builds one of those from several years, but doesn't do
  `pvcalculation` - it would need this script to also implement a
  tilt/azimuth transposition model itself, not done here).

**Still explicitly not the finished state** (see ROADMAP.md's "Known
gaps"): every array uses its own country's ONE fixed orientation regardless
of the tilt/azimuth actually set on it in the Design tab (recomputing this
per arbitrary tilt/azimuth combination would mean a live PVGIS call per
calculation, not a precomputable static dataset) - still
`genericSource.ts`'s own TODO. One specific historical year's weather also
isn't the same as a statistically representative year (see the `tmy` note
above), and a single representative point per country is a poor
approximation for large, climate-diverse countries (see the China note
above).

This is a one-time build, like every other scripts/build_*.py in this
project family - re-run by hand if jurisdictions.geojson changes, or
periodically to pick up a more recent PVGIS year once one is available
across every database this script hits:

    python3 scripts/build_country_irradiance.py

Whenever this file's output changes, `country-self-sufficiency.json` (built
from it - see build_self_sufficiency.ts) goes stale until re-run too.
"""

import json
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import shape

try:
    import certifi

    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = ssl.create_default_context()

ROOT = Path(__file__).resolve().parent.parent
GEOJSON_PATH = ROOT / "src" / "assets" / "jurisdictions.geojson"
OUT_PATH = ROOT / "src" / "data" / "country-irradiance.json"

POPULATED_PLACES_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson"
)

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_2/seriescalc"
PVGIS_YEAR = 2015  # see this script's own doc comment - the one year confirmed valid across every PVGIS database this script hits
REQUEST_DELAY_SECONDS = 0.15  # PVGIS's own documented limit is 30 calls/sec/IP - well under that
MAX_RETRIES = 3
MIN_TILT_DEG = 5
MAX_TILT_DEG = 35


def biggest_city_points() -> dict[str, tuple[float, float]]:
    """code -> (lat, lon) of the most populous city in that country, from
    Natural Earth's own `ne_10m_populated_places` (public domain, same
    source/host as `build_geometry.py`'s own admin boundaries) - grouped by
    its `ISO_A2` field, keeping whichever place has the highest `POP_MAX`.
    Covers 225 of 234 country-level codes (checked 2026-09-18); the rest
    (mostly tiny territories - Pitcairn, Heard Island, Niue - plus Kosovo
    and Nauru, missing here for less obvious reasons) fall back to
    `representative_point()` in `country_points()` below."""
    with urllib.request.urlopen(POPULATED_PLACES_URL, timeout=60, context=SSL_CONTEXT) as response:
        data = json.loads(response.read())

    best: dict[str, tuple[float, float, float]] = {}  # code -> (pop, lat, lon)
    for feature in data["features"]:
        props = feature["properties"]
        code = props.get("ISO_A2")
        if not code or code in ("-99", ""):
            continue
        pop = props.get("POP_MAX") or 0
        if code not in best or pop > best[code][0]:
            best[code] = (pop, props["LATITUDE"], props["LONGITUDE"])

    return {code: (lat, lon) for code, (_, lat, lon) in best.items()}


def geometry_points() -> dict[str, tuple[float, float]]:
    """code -> (lat, lon) via shapely's own `representative_point()` on each
    country's geometry in jurisdictions.geojson, for every non-subnational
    code (no "-" in it) - this script's original location strategy before
    2026-09-18, kept as the fallback `country_points()` below reaches for
    when a city point fails PVGIS outright."""
    data = json.loads(GEOJSON_PATH.read_text())
    points: dict[str, tuple[float, float]] = {}
    for feature in data["features"]:
        code = feature["properties"].get("code")
        if not code or "-" in code:
            continue
        geom = feature.get("geometry")
        if not geom:
            continue
        point = shape(geom).representative_point()
        points[code] = (point.y, point.x)  # (lat, lon)
    return points


def country_points() -> dict[str, tuple[float, float, tuple[float, float] | None]]:
    """code -> (lat, lon, fallback_lat_lon) for every non-subnational
    jurisdiction - every one of these 234 entries has its own real geometry
    in jurisdictions.geojson (confirmed by inspection 2026-09-16, including
    AU/US/CA, which this app's own map treats as "not mappable" at the
    country level but which still carry a real national outline here).

    Prefers the country's own biggest city (`biggest_city_points` above)
    over `geometry_points`' own geometric `representative_point()`, per
    Andrew's own instruction 2026-09-18 ("we should calculate the
    irradiance at the location of the most populous city?") - fixes
    exactly the China problem documented elsewhere in this file (a
    polygon-only representative point can land in an empty, climatically
    unrepresentative corner of a large country; its biggest city can't, by
    definition, since real solar buyers live in and around it). Still a
    single point per country, so a country whose population spans
    genuinely different climates isn't fixed by this alone - just less
    arbitrary about which single point it picks.

    Also returns each code's own `geometry_points()` value as a fallback,
    used by `main()` when the city point itself fails PVGIS - found the
    same day this shipped: a coastal capital's exact coordinates (Conakry,
    Guinea; several small island nations) can land just outside PVGIS's
    own land/sea classification at that precise point ("Location over the
    sea"), even though the country obviously has land and people. The
    interior-guaranteed `representative_point()` almost never has this
    problem, so it's a sensible second attempt rather than just giving up
    on a country PVGIS could otherwise serve fine.
    """
    city_points = biggest_city_points()
    fallback_points = geometry_points()
    points: dict[str, tuple[float, float, tuple[float, float] | None]] = {}
    for code, fallback in fallback_points.items():
        if code in city_points:
            points[code] = (*city_points[code], fallback)
        else:
            points[code] = (*fallback, None)
    return points


def fetch_pvgis_profile(lat: float, lon: float) -> tuple[float, float, list[float]]:
    """Returns (tilt_deg, azimuth_deg, profile_w_per_wp) for one location, via
    PVGIS's own rooftop (`mountingplace=building`), 1kWp, zero-loss PV
    calculation, at this script's own fixed-angle heuristic (due south in
    the northern hemisphere / due north in the southern, tilt clamped to
    this location's own latitude, 5-35°) - see this file's own top-of-file
    doc comment for why that's a fixed heuristic and not PVGIS's own
    `optimalangles=1`. Retries a couple of times on PVGIS's own
    rate-limit/overload responses (429/529) or a transient network error,
    with a short backoff; a 400 (no data for this location at all - open
    ocean, or genuinely outside PVGIS's spatial coverage) fails immediately,
    no point retrying that."""
    hemisphere_north = lat >= 0
    azimuth_deg = 0 if hemisphere_north else 180
    tilt_deg = max(MIN_TILT_DEG, min(MAX_TILT_DEG, round(abs(lat))))

    params = {
        "lat": lat,
        "lon": lon,
        "outputformat": "json",
        "pvcalculation": 1,
        "peakpower": 1,
        "loss": 0,
        "mountingplace": "building",
        "angle": tilt_deg,
        "aspect": azimuth_deg,
        "startyear": PVGIS_YEAR,
        "endyear": PVGIS_YEAR,
        # PVGIS defaults usehorizon=1 - it shades the calculation against
        # the REAL terrain surrounding this exact lat/lon (elevation data,
        # not just tilt/azimuth self-shading). That's appropriate for one
        # real address, but wrong for a single country-wide representative
        # point: found 2026-09-18 when Greece's own point (39.0845, 21.8069
        # - inland, 651m elevation, in hilly terrain) came back at 1043
        # kWh/kWp/yr, noticeably lower than Germany (1209) despite being
        # much further south - confirmed via a direct PVGIS call that
        # usehorizon=0 for that exact point gives 1531, in line with
        # neighbouring Mediterranean countries. A representative point
        # landing in a valley or hillside shouldn't crush the whole
        # country's figure with terrain shading specific to that one spot -
        # see this file's own top-of-file doc comment for the broader
        # single-representative-point limitation this is one instance of.
        "usehorizon": 0,
    }
    url = f"{PVGIS_URL}?{urllib.parse.urlencode(params)}"

    last_error: Exception | None = None
    for retry in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(url, timeout=30, context=SSL_CONTEXT) as response:
                data = json.loads(response.read())
            profile = [round(row["P"] / 1000, 4) for row in data["outputs"]["hourly"]]
            return tilt_deg, azimuth_deg, profile
        except urllib.error.HTTPError as err:
            if err.code == 400:
                raise RuntimeError("no PVGIS data for this location") from err
            last_error = err
            time.sleep(1.5 * (retry + 1))
        except (urllib.error.URLError, KeyError, json.JSONDecodeError) as err:
            last_error = err
            time.sleep(1.5 * (retry + 1))

    raise RuntimeError(f"PVGIS request failed after {MAX_RETRIES} attempts") from last_error


def main() -> None:
    points = country_points()
    out: dict[str, dict] = {}
    skipped: list[str] = []

    for i, (code, (lat, lon, fallback)) in enumerate(sorted(points.items()), start=1):
        try:
            tilt_deg, azimuth_deg, profile = fetch_pvgis_profile(lat, lon)
        except RuntimeError as err:
            if fallback is None:
                print(f"[{i}/{len(points)}] {code}: SKIPPED - {err}")
                skipped.append(code)
                continue
            lat, lon = fallback
            try:
                tilt_deg, azimuth_deg, profile = fetch_pvgis_profile(lat, lon)
                print(f"[{i}/{len(points)}] {code}: city point failed ({err}), fell back to representative_point()")
            except RuntimeError as fallback_err:
                print(f"[{i}/{len(points)}] {code}: SKIPPED - city point failed ({err}), fallback also failed ({fallback_err})")
                skipped.append(code)
                continue

        if len(profile) != 8760:
            print(f"[{i}/{len(points)}] {code}: SKIPPED - got {len(profile)} hours, expected 8760 (leap year?)")
            skipped.append(code)
            continue

        out[code] = {
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "tiltDeg": tilt_deg,
            "azimuthDeg": azimuth_deg,
            "profileWPerWp": profile,
        }
        annual_kwh_per_kwp = sum(profile)
        print(f"[{i}/{len(points)}] {code}: {annual_kwh_per_kwp:.0f} kWh/kWp/yr (tilt {tilt_deg}°, azimuth {azimuth_deg}°)")
        time.sleep(REQUEST_DELAY_SECONDS)

    OUT_PATH.write_text(json.dumps(out, separators=(",", ":")))

    sample = out.get("ES") or next(iter(out.values()))
    annual_kwh_per_kwp = sum(sample["profileWPerWp"])
    print(f"\nWrote {OUT_PATH} - {len(out)} countries ({len(skipped)} skipped: {skipped})")
    print(f"Sample check (lat {sample['lat']}): {annual_kwh_per_kwp:.0f} kWh/kWp/yr")


if __name__ == "__main__":
    main()
