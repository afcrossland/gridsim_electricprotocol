#!/usr/bin/env python3
"""Build data/ember_solar.json - the real solar-capacity "database" this app
reads from, replacing src/data/dummyDeployment.ts's placeholder numbers
country by country as real data comes in.

Source: Ember's public monthly wind/solar capacity release -
https://files.ember-energy.org/public-downloads/capacity/outputs/monthly_capacity_wind_solar_public_release_file.csv
(~1.2MB, no key required). Confirmed by inspection 2026-09-09: one row per
country/month/technology, `Source` includes "Solar" as its own row (not a
rooftop/utility/distributed split - Ember's own data has no such
breakdown), `Is aggregate area` distinguishes real countries from regional
rollups ("World", "Europe", etc.), and only **25 countries** actually carry
a "Solar" series - everyone else in this app's map still falls back to
`dummyDeployment.ts` or shows as no data.

**Correction, 2026-09-09**: every one of those 25 countries reports *two*
permanently parallel rows per month - one `GWAC`, one `GWDC` - not a
mid-series unit-convention switch as this docstring previously (wrongly)
claimed. An earlier version of this script kept both rows and sorted only
by (year, month), so the AC and DC figures for the same month interleaved
in whatever order the CSV happened to list them - each one on its own
climbs steadily, but zig-zagging between two different-sized series read
as capacity going up and down. Fixed by keeping only `GWDC` (DC nameplate
- the more common "installed capacity" convention, e.g. IRENA/IEA) and
dropping the AC row entirely, so each country now has exactly one row per
month again.

Usage note: this is a **one-time read for now**, run by hand when the data
needs refreshing, not wired into a build step or scheduled job yet.
Redistributing this data via the app is confirmed fine, 2026-09-10 -
Ember's data is published under a Creative Commons Attribution 4.0
licence (https://creativecommons.org/licenses/by/4.0/), which permits
this as long as Ember is credited (see the app's own Help page) and any
computed/derived figures are flagged as such, not presented as Ember's
own numbers verbatim. This script still doesn't run automatically
anywhere - re-run it manually:

    python3 scripts/build_ember_solar.py
"""

import csv
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = (
    "https://files.ember-energy.org/public-downloads/capacity/outputs/"
    "monthly_capacity_wind_solar_public_release_file.csv"
)

OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "ember_solar.json"

# Ember's file uses ISO 3166-1 alpha-3; this app (like ep_policymap) keys
# everything by alpha-2. Hand-mapped rather than pulling in a country-code
# library for the 25 codes this file actually contains - re-derive if a
# future edition of the Ember file adds a country not in this map, rather
# than silently dropping it.
ISO3_TO_ISO2 = {
    "ARG": "AR", "AUS": "AU", "BEL": "BE", "BRA": "BR", "CHL": "CL",
    "CHN": "CN", "DEU": "DE", "DNK": "DK", "ESP": "ES", "FIN": "FI",
    "FRA": "FR", "GBR": "GB", "HUN": "HU", "IND": "IN", "ITA": "IT",
    "JPN": "JP", "KOR": "KR", "NLD": "NL", "PHL": "PH", "POL": "PL",
    "PRT": "PT", "TUR": "TR", "TWN": "TW", "USA": "US", "ZAF": "ZA",
}


def download(url: str, dest: Path) -> None:
    print(f"Downloading {url} ...", file=sys.stderr)
    urllib.request.urlretrieve(url, dest)
    print(f"Saved to {dest} ({dest.stat().st_size / 1e3:.0f} KB)", file=sys.stderr)


def build(csv_path: Path) -> dict:
    countries: dict[str, dict] = {}
    unmapped: set[str] = set()

    with csv_path.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["Source"] != "Solar" or row["Is aggregate area"] != "0":
                continue
            if row["Unit"] != "GWDC":
                continue  # drop the parallel GWAC row - see docstring correction above
            iso3 = row["ISO 3 Code"]
            code = ISO3_TO_ISO2.get(iso3)
            if not code:
                unmapped.add(iso3)
                continue

            entry = countries.setdefault(code, {"name": row["Area"], "series": []})
            entry["series"].append(
                {
                    "year": int(row["Year"]),
                    "month": int(row["Month"]),
                    # GW as reported - AC/DC rating varies row to row (Ember
                    # changed convention partway through the series), kept
                    # rather than silently normalised, so a chart can flag
                    # the switch instead of showing a fake discontinuity.
                    "gw": float(row["Installed Capacity"]),
                    "unit": row["Unit"],
                }
            )

    if unmapped:
        print(f"WARNING: no ISO2 mapping for {unmapped} - update ISO3_TO_ISO2", file=sys.stderr)

    for entry in countries.values():
        entry["series"].sort(key=lambda r: (r["year"], r["month"]))

    return countries


def report_new_countries(out_path: Path, new_codes: set[str]) -> None:
    """Diffs against the previous build's own output, if one exists, and
    flags any country code that wasn't there before - added 2026-09-10 so a
    country newly reporting to Ember doesn't go unnoticed just because
    re-running this script by hand looks the same either way."""
    if not out_path.exists():
        return
    old_codes = set(json.loads(out_path.read_text()).get("countries", {}).keys())
    added = new_codes - old_codes
    if added:
        print(f"NEW COUNTRIES since last build: {sorted(added)}", file=sys.stderr)
    else:
        print("No new countries since last build.", file=sys.stderr)


def main() -> None:
    csv_path = Path(__file__).resolve().parent / "_ember_capacity_download_cache.csv"
    if not csv_path.exists():
        download(SOURCE_URL, csv_path)
    else:
        print(f"Reusing cached download at {csv_path}", file=sys.stderr)

    countries = build(csv_path)
    report_new_countries(OUT_PATH, set(countries.keys()))

    output = {
        "source": SOURCE_URL,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "note": (
            "Solar installed capacity (GW), DC nameplate rating, only - "
            "Ember's file has no rooftop/utility/distributed split, and no "
            "battery storage at all. One row per country per month - "
            "Ember also reports a parallel GWAC-rated figure per country, "
            "dropped here rather than kept alongside the DC one."
        ),
        "countries": countries,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(output, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} - {len(countries)} countries", file=sys.stderr)


if __name__ == "__main__":
    main()
