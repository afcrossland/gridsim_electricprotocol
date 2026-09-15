#!/usr/bin/env python3
"""Build src/data/global_solar.json - a synthetic "Global" pseudo-country
for the sidebar's pinned world-total row (see Sidebar.tsx's GLOBAL_CODE
handling and lib/globalSolar.ts).

This is a **derived, computed figure - not something Ember itself
publishes** as a single series. Ember's monthly API only covers 25
countries and its yearly CSV's Capacity (GW) column covers ~180 more, each
with its own start year and, for the annual set, its own last-reported
year - there is no ready-made "world total over time" column to read. Per
Ember's CC BY 4.0 licence (see build_ember_solar.py's own docstring), a
derived figure like this must be flagged as computed, not presented as
Ember's own number - see the `source` field this script writes.

Method: for every year from the earliest one any country reports (2000) to
the latest (the newest year/month found across every country), sum each
country's own latest known value **as of that year** (its own most recent
point with year <= Y - a monthly country's December value if it reported
that far, otherwise its latest earlier point; an annual country's own
annualSeries the same way). A country with no data yet by year Y
contributes 0, not a gap - solar capacity before a country's first
reported point is genuinely ~0 in every case checked, not missing data.
This is a forward-fill sum applied at every year in the range, not just
the final one, so the chart's own last point reads as "right now" the same
way any real country's own latest point does.

Usage: one-time read, like the other build_*.py scripts here - re-run by
hand after ember_solar.json is refreshed:

    python3 scripts/build_global_solar.py
"""

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = ROOT / "src" / "data" / "ember_solar.json"
OUT_PATH = ROOT / "src" / "data" / "global_solar.json"

MIN_YEAR = 2000


def latest_value_by_year(country: dict) -> dict[int, float]:
    """Every (year, month, gw) or (year, gw) point this country has, reduced
    to one "latest gw reported with year <= Y" value per calendar year in
    its own range - the building block forward-filled below."""
    if country["granularity"] == "monthly":
        points = [(p["year"], p["month"], p["gw"]) for p in country["series"]]
    else:
        points = [(p["year"], 12, p["gw"]) for p in country["annualSeries"]]
    points.sort()
    return points


def main() -> None:
    data = json.loads(SOURCE_PATH.read_text())
    countries = data["countries"]

    max_year = 0
    for c in countries.values():
        points = latest_value_by_year(c)
        if points:
            max_year = max(max_year, points[-1][0])

    annual_series = []
    for year in range(MIN_YEAR, max_year + 1):
        total = 0.0
        for c in countries.values():
            points = latest_value_by_year(c)
            # Latest point with year <= this one - "0 before the country's
            # first report" falls out naturally: no point qualifies, total
            # stays unchanged (adds 0).
            value = 0.0
            for p_year, _p_month, p_gw in points:
                if p_year <= year:
                    value = p_gw
                else:
                    break
            total += value
        annual_series.append({"year": year, "gw": round(total, 2)})

    out = {
        "source": "Computed by scripts/build_global_solar.py from src/data/ember_solar.json - "
        "not an Ember-published series. See this script's own docstring for the forward-fill "
        "methodology; flagged as a derived figure per Ember's CC BY 4.0 attribution terms.",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "country": {
            "name": "Global",
            "granularity": "annual",
            "annualSeries": annual_series,
        },
    }
    OUT_PATH.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {OUT_PATH} - {len(annual_series)} years, {MIN_YEAR}-{max_year}, "
          f"latest total {annual_series[-1]['gw']} GW")


if __name__ == "__main__":
    main()
