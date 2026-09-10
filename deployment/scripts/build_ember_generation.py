#!/usr/bin/env python3
"""Build src/data/ember_generation.json - solar's share of a country's own
annual electricity generation, a second, wider-coverage dataset alongside
src/data/ember_solar.json's installed-capacity numbers.

Source: Ember's public monthly generation release -
https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_monthly_global.csv
(~28MB, no key required). Confirmed by inspection 2026-09-09: one row per
area/month/electricity-source, with both `Generation (TWh)` and
`Share of generation (%)` columns. `Share of generation (%)` is itself a
*monthly* figure, so it can't be read off directly for an annual share -
this script sums each country's monthly Solar and Total generation TWh
across a calendar year and divides, rather than averaging the monthly
percentages (which would distort seasonal countries). A year is only kept
if all 12 months of both Solar and Total generation rows are present, so
the in-progress current year is dropped rather than shown as a misleadingly
low partial-year share.

Filtered to `Area type == "Country or economy"` (drops Ember's own
regional/bloc rollups like "ASEAN", "G20", "World") and
`Is aggregated source == "False"` (Solar is not itself a roll-up of other
sources). 77 countries carry a "Solar" series this way - Ember's generation
data has meaningfully wider country coverage than its capacity file's 25,
since generation is reported from grid operator data even where a
country's own installed-capacity register is thin.

Usage note: same one-time-read status as build_ember_solar.py - run by
hand, not wired into a build step or scheduled job, pending Andrew
confirming Ember's terms for redistributing this data via the app.

    python3 scripts/build_ember_generation.py
"""

import csv
import json
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pycountry

SOURCE_URL = (
    "https://files.ember-energy.org/public-downloads/generation/outputs/"
    "release_generation_monthly_global.csv"
)

OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "ember_generation.json"


def iso3_to_iso2(iso3: str) -> str | None:
    try:
        country = pycountry.countries.get(alpha_3=iso3)
        return country.alpha_2 if country else None
    except (LookupError, AttributeError):
        return None


def download(url: str, dest: Path) -> None:
    print(f"Downloading {url} ...", file=sys.stderr)
    urllib.request.urlretrieve(url, dest)
    print(f"Saved to {dest} ({dest.stat().st_size / 1e6:.1f} MB)", file=sys.stderr)


def build(csv_path: Path) -> dict:
    # (iso3, year) -> month -> TWh, for Solar and for Total generation separately.
    solar_months: dict[tuple[str, int], dict[int, float]] = defaultdict(dict)
    total_months: dict[tuple[str, int], dict[int, float]] = defaultdict(dict)
    names: dict[str, str] = {}

    with csv_path.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["Area type"] != "Country or economy":
                continue
            source = row["Electricity source"]
            if source not in ("Solar", "Total generation"):
                continue
            # "Solar" is a real, non-aggregated source; "Total generation"
            # is itself the sum of every source, so it's the one row where
            # Is aggregated source is expected to say True - only Solar
            # needs the aggregate-exclusion check.
            if source == "Solar" and row["Is aggregated source"] != "False":
                continue

            iso3 = row["ISO 3 code"]
            if not iso3:
                continue
            names[iso3] = row["Area"]

            date = row["Date"]  # e.g. "2019-01-01"
            year, month = int(date[:4]), int(date[5:7])
            twh = float(row["Generation (TWh)"]) if row["Generation (TWh)"] else None
            if twh is None:
                continue

            bucket = solar_months if source == "Solar" else total_months
            bucket[(iso3, year)][month] = twh

    countries: dict[str, dict] = {}
    unmapped: set[str] = set()

    all_keys = sorted(set(solar_months) & set(total_months))
    by_iso3: dict[str, list] = defaultdict(list)

    for iso3, year in all_keys:
        solar_by_month = solar_months[(iso3, year)]
        total_by_month = total_months[(iso3, year)]
        if len(solar_by_month) != 12 or len(total_by_month) != 12:
            continue  # partial year (in-progress current year, or a gap) - skip rather than mislead
        solar_twh = sum(solar_by_month.values())
        total_twh = sum(total_by_month.values())
        if total_twh <= 0:
            continue
        by_iso3[iso3].append(
            {
                "year": year,
                "solarTWh": round(solar_twh, 4),
                "totalTWh": round(total_twh, 4),
                "sharePct": round(solar_twh / total_twh * 100, 3),
            }
        )

    for iso3, series in by_iso3.items():
        code = iso3_to_iso2(iso3)
        if not code:
            unmapped.add(iso3)
            continue
        series.sort(key=lambda r: r["year"])
        countries[code] = {"name": names[iso3], "series": series}

    if unmapped:
        print(f"WARNING: no ISO2 mapping for {sorted(unmapped)}", file=sys.stderr)

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
    csv_path = Path(__file__).resolve().parent / "_ember_generation_download_cache.csv"
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
            "Solar's share of each country's own total annual electricity "
            "generation (%), not installed capacity - a different question "
            "from ember_solar.json. Annual figures are built by summing "
            "12 months of Solar and Total generation TWh and dividing; a "
            "year is only included if both series have all 12 months "
            "(the in-progress current year is dropped, not shown partial)."
        ),
        "countries": countries,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(output, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} - {len(countries)} countries", file=sys.stderr)


if __name__ == "__main__":
    main()
