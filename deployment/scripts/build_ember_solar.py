#!/usr/bin/env python3
"""Build src/data/ember_solar.json - the real solar-capacity "database" this
app reads from for the Installed Capacity metric.

Two sources, combined per country:

1. **Monthly** - Ember's own Data API, `GET /v1/installed-capacity/monthly`
   (https://api.ember-energy.org/v1/docs), migrated 2026-09-10 off Ember's
   public CSV download (files.ember-energy.org/.../monthly_capacity_wind_solar_public_release_file.csv) -
   see _ember_api.py's own docstring for how that migration was checked.
   Confirmed by a live call: **25 countries**, `capacity_gw` field, full
   history from 2016-01 through the latest available month (2026-08 as of
   this writing) returned in one call. Cross-checked against the old
   CSV-sourced output before switching over - see the git history of this
   file for the comparison report; the two sources agreed exactly.

2. **Annual** - Ember's yearly generation release's own `Capacity (GW)`
   column (https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_yearly_global.csv,
   ~16MB - **still a CSV, not the API**: confirmed 2026-09-10 that no
   `/installed-capacity/yearly` endpoint exists - the OpenAPI spec doesn't
   list one, and calling it directly 404s. This is the one piece of this
   script's data with no API path yet), filtered to
   `Electricity source == "Solar"` and `Area type == "Country or economy"`.
   Confirmed by inspection: **173 countries** have a nonzero Solar capacity
   figure for 2023, 168 for 2024 - 2025 itself is a partial year at the
   time of writing (only 84 countries so far), so this is a genuinely
   broader source than the monthly one, just coarser (one point a year).

**Each country takes whichever source's own latest point is more recent**
(Andrew's instruction) - a country with monthly data reaching further
forward than its own annual figure uses the monthly series (true for all
25 monthly-covered countries in practice, since the monthly source already
reaches into 2026 and the annual one caps out at 2025, but compared
properly per country rather than assumed); everyone else uses the annual
series. A country's entry is `"granularity": "monthly"` with a `series` of
`{year, month, gw}` points, or `"granularity": "annual"` with an
`annualSeries` of `{year, gw}` points - never both, so a chart rendering
one country's history is never asked to mix monthly and yearly cadence in
one line.

Usage note: this is a **one-time read for now**, run by hand when the data
needs refreshing, not wired into a build step or scheduled job yet.
Redistributing this data via the app is confirmed fine, 2026-09-10 -
Ember's data is published under a Creative Commons Attribution 4.0
licence (https://creativecommons.org/licenses/by/4.0/), which permits
this as long as Ember is credited (see the app's own Help page) and any
computed/derived figures are flagged as such, not presented as Ember's
own numbers verbatim. This script still doesn't run automatically
anywhere - re-run it manually (needs EMBER_API_KEY - see _ember_api.py):

    python3 scripts/build_ember_solar.py
"""

import csv
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from _ember_api import fetch, iso3_to_iso2

ANNUAL_CSV_URL = (
    "https://files.ember-energy.org/public-downloads/generation/outputs/"
    "release_generation_yearly_global.csv"
)

SCRIPTS_DIR = Path(__file__).resolve().parent
OUT_PATH = SCRIPTS_DIR.parent / "src" / "data" / "ember_solar.json"


def download(url: str, dest: Path) -> None:
    print(f"Downloading {url} ...", file=sys.stderr)
    urllib.request.urlretrieve(url, dest)
    print(f"Saved to {dest} ({dest.stat().st_size / 1e3:.0f} KB)", file=sys.stderr)


def fetch_csv(url: str, cache_name: str) -> Path:
    path = SCRIPTS_DIR / cache_name
    if not path.exists():
        download(url, path)
    else:
        print(f"Reusing cached download at {path}", file=sys.stderr)
    return path


def build_monthly_from_api() -> dict[str, dict]:
    """iso3 -> {name, series: [{year, month, gw}]} - via the Ember API, see module docstring."""
    rows = fetch("/installed-capacity/monthly", series="Solar", is_aggregate_entity="false")
    countries: dict[str, dict] = {}
    for row in rows:
        iso3 = row.get("entity_code")
        if not iso3:
            continue
        year, month = int(row["date"][:4]), int(row["date"][5:7])
        entry = countries.setdefault(iso3, {"name": row["entity"], "series": []})
        entry["series"].append({"year": year, "month": month, "gw": row["capacity_gw"]})
    for entry in countries.values():
        entry["series"].sort(key=lambda r: (r["year"], r["month"]))
    return countries


def build_annual_from_csv(csv_path: Path) -> dict[str, dict]:
    """iso3 -> {name, series: [{year, gw}]} - every year with a Capacity (GW) value, including real zeros."""
    countries: dict[str, dict] = {}
    with csv_path.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["Electricity source"] != "Solar" or row["Area type"] != "Country or economy":
                continue
            cap = row["Capacity (GW)"]
            if cap == "" or cap is None:
                continue  # not reported that year - distinct from a real 0.0
            iso3 = row["ISO 3 code"]
            entry = countries.setdefault(iso3, {"name": row["Area"], "series": []})
            entry["series"].append({"year": int(row["Year"]), "gw": float(cap)})
    for entry in countries.values():
        entry["series"].sort(key=lambda r: r["year"])
    return countries


def combine(monthly: dict[str, dict], annual: dict[str, dict]) -> tuple[dict[str, dict], set[str]]:
    """Picks, per ISO3, whichever source's own latest point is more recent - see module docstring."""
    countries: dict[str, dict] = {}
    unmapped: set[str] = set()

    for iso3 in set(monthly) | set(annual):
        m = monthly.get(iso3)
        a = annual.get(iso3)

        use_monthly: bool
        if m and a:
            m_latest = (m["series"][-1]["year"], m["series"][-1]["month"])
            a_latest = (a["series"][-1]["year"], 12)  # an annual figure means "as of the end of that year"
            use_monthly = m_latest >= a_latest
        else:
            use_monthly = m is not None

        code = iso3_to_iso2(iso3)
        if not code:
            unmapped.add(iso3)
            continue

        if use_monthly:
            countries[code] = {"name": m["name"], "granularity": "monthly", "series": m["series"]}
        else:
            countries[code] = {"name": a["name"], "granularity": "annual", "annualSeries": a["series"]}

    return countries, unmapped


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
    print("Fetching monthly capacity from the Ember API ...", file=sys.stderr)
    monthly = build_monthly_from_api()

    annual_csv = fetch_csv(ANNUAL_CSV_URL, "_ember_generation_yearly_download_cache.csv")
    annual = build_annual_from_csv(annual_csv)

    countries, unmapped = combine(monthly, annual)

    if unmapped:
        print(f"WARNING: no ISO2 mapping for {sorted(unmapped)}", file=sys.stderr)

    monthly_n = sum(1 for c in countries.values() if c["granularity"] == "monthly")
    annual_n = len(countries) - monthly_n
    report_new_countries(OUT_PATH, set(countries.keys()))

    output = {
        "source": {
            "monthly": "https://api.ember-energy.org/v1/installed-capacity/monthly",
            "annual": ANNUAL_CSV_URL,
        },
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "note": (
            "Solar installed capacity (GW). Each country takes whichever "
            "source's own latest point is more recent: Ember's Data API "
            "(monthly cadence, 25 countries) or the yearly generation "
            "CSV's own Capacity (GW) column (one point a year, wider "
            "coverage - no API equivalent exists for this one). A "
            'country\'s entry is either "granularity": "monthly" with a '
            "`series` of {year, month, gw} points, or "
            '"granularity": "annual" with an `annualSeries` of {year, gw} '
            "points - never both."
        ),
        "countries": countries,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(output, separators=(",", ":")))
    print(
        f"Wrote {OUT_PATH} - {len(countries)} countries ({monthly_n} monthly, {annual_n} annual)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
