#!/usr/bin/env python3
"""Build src/data/ember_generation.json - solar's share of a country's own
annual electricity generation, a second, wider-coverage dataset alongside
src/data/ember_solar.json's installed-capacity numbers.

Source: Ember's own Data API, `GET /v1/electricity-generation/yearly`
(https://api.ember-energy.org/v1/docs) - migrated 2026-09-10 off Ember's
public monthly-generation CSV download, which this script used to sum
itself into annual figures. Two calls, one for `series=Solar` and one for
`series=Total generation` (both queryable directly - confirmed live,
`Total generation` always reports `share_of_generation_pct: 100`, i.e. it
really is the whole-generation denominator, not a category needing its own
aggregation), matched up by (country, year). No summing of monthly figures
needed any more, and confirmed by a live call to cover **194 countries**
for Solar 2024, versus the 77 the old CSV-summing approach reached (that
approach required a country to report *all 12 months* of both Solar and
Total generation before counting a year at all, which these already-annual
API figures don't need).

**Correction, 2026-09-10**: an earlier version of this migration derived
`totalTWh` as `solarTWh / (sharePct / 100)` instead of querying `Total
generation` directly, then dropped every row with `share_of_generation_pct
<= 0` to dodge the division-by-zero this caused - which turned out to
throw away 3,070 genuinely valid rows (a country's real "0% solar" years
before it had any, not bad data - only 1 row in the whole dataset was an
actual negative-share anomaly). Fixed by fetching `Total generation`
directly instead of deriving it, so a zero-share year is a real data point
now, not an indeterminate 0/0.

Usage note: same one-time-read status as build_ember_solar.py - run by
hand, not wired into a build step or scheduled job. Redistributing this
data via the app is confirmed fine, 2026-09-10 - see build_ember_solar.py's
own docstring for the Creative Commons Attribution 4.0 licence details.
Needs EMBER_API_KEY - see _ember_api.py.

    python3 scripts/build_ember_generation.py
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from _ember_api import fetch, iso3_to_iso2

OUT_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "ember_generation.json"


def build() -> dict:
    solar_rows = fetch("/electricity-generation/yearly", series="Solar", is_aggregate_entity="false")
    total_rows = fetch("/electricity-generation/yearly", series="Total generation", is_aggregate_entity="false")

    # (iso3, year) -> total generation TWh
    totals: dict[tuple[str, int], float] = {}
    for row in total_rows:
        iso3 = row.get("entity_code")
        if not iso3 or row["generation_twh"] is None:
            continue
        totals[(iso3, int(row["date"]))] = row["generation_twh"]

    names: dict[str, str] = {}
    by_iso3: dict[str, list[dict]] = {}
    skipped_invalid = 0
    skipped_no_total = 0

    for row in solar_rows:
        iso3 = row.get("entity_code")
        if not iso3:
            continue
        solar_twh = row["generation_twh"]
        share_pct = row["share_of_generation_pct"]
        if solar_twh is None or share_pct is None or solar_twh < 0 or share_pct < 0:
            skipped_invalid += 1
            continue

        year = int(row["date"])
        total_twh = totals.get((iso3, year))
        if total_twh is None or total_twh <= 0:
            skipped_no_total += 1
            continue

        names[iso3] = row["entity"]
        by_iso3.setdefault(iso3, []).append(
            {
                "year": year,
                "solarTWh": round(solar_twh, 4),
                "totalTWh": round(total_twh, 4),
                "sharePct": round(share_pct, 3),
            }
        )

    countries: dict[str, dict] = {}
    unmapped: set[str] = set()
    for iso3, series in by_iso3.items():
        code = iso3_to_iso2(iso3)
        if not code:
            unmapped.add(iso3)
            continue
        series.sort(key=lambda r: r["year"])
        countries[code] = {"name": names[iso3], "series": series}

    if unmapped:
        print(f"WARNING: no ISO2 mapping for {sorted(unmapped)}", file=sys.stderr)
    if skipped_invalid:
        print(f"Skipped {skipped_invalid} Solar rows with a negative share/generation or missing value", file=sys.stderr)
    if skipped_no_total:
        print(f"Skipped {skipped_no_total} rows with no matching Total generation figure for that year", file=sys.stderr)

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
    countries = build()
    report_new_countries(OUT_PATH, set(countries.keys()))

    output = {
        "source": "https://api.ember-energy.org/v1/electricity-generation/yearly",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "note": (
            "Solar's share of each country's own total annual electricity "
            "generation (%), not installed capacity - a different question "
            "from ember_solar.json. solarTWh, sharePct and totalTWh all come "
            "straight from Ember's API (two series, Solar and Total "
            "generation, matched by country and year) - none of them are "
            "computed here."
        ),
        "countries": countries,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(output, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} - {len(countries)} countries", file=sys.stderr)


if __name__ == "__main__":
    main()
