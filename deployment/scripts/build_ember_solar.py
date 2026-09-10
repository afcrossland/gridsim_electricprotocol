#!/usr/bin/env python3
"""Build src/data/ember_solar.json - the real solar-capacity "database" this
app reads from for the Installed Capacity metric.

Two sources now, combined per country - 2026-09-10:

1. **Monthly** - Ember's monthly wind/solar capacity release
   (https://files.ember-energy.org/public-downloads/capacity/outputs/monthly_capacity_wind_solar_public_release_file.csv,
   ~1.2MB). Confirmed by inspection: one row per country/month/technology,
   `Source` includes "Solar" as its own row (no rooftop/utility split),
   `Is aggregate area` distinguishes real countries from regional rollups.
   Only **25 countries** carry a "Solar" series here. Every one of those 25
   reports two permanently parallel rows per month - `GWAC` and `GWDC` -
   not a mid-series unit-convention switch (an earlier version of this
   script wrongly assumed that and interleaved them, which made capacity
   look like it went up and down); only `GWDC` (DC nameplate - the more
   common "installed capacity" convention, e.g. IRENA/IEA) is kept.

2. **Annual** - Ember's yearly generation release's own `Capacity (GW)`
   column (https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_yearly_global.csv,
   ~16MB), filtered to `Electricity source == "Solar"` and
   `Area type == "Country or economy"`. Confirmed by inspection 2026-09-10:
   **173 countries** have a nonzero Solar capacity figure for 2023, 168 for
   2024 - 2025 itself is a partial year at the time of writing (only 84
   countries so far), so this is a genuinely broader source than the
   monthly file, just coarser (one point a year, not one a month).

**Each country takes whichever source's own latest point is more recent**
(Andrew's instruction) - a country with monthly data reaching further
forward than its own annual figure uses the monthly series (true for all
25 monthly-covered countries in practice, since the monthly file already
reaches into 2026 and the annual file caps out at 2025, but compared
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
anywhere - re-run it manually:

    python3 scripts/build_ember_solar.py
"""

import csv
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pycountry

MONTHLY_URL = (
    "https://files.ember-energy.org/public-downloads/capacity/outputs/"
    "monthly_capacity_wind_solar_public_release_file.csv"
)
ANNUAL_URL = (
    "https://files.ember-energy.org/public-downloads/generation/outputs/"
    "release_generation_yearly_global.csv"
)

SCRIPTS_DIR = Path(__file__).resolve().parent
OUT_PATH = SCRIPTS_DIR.parent / "src" / "data" / "ember_solar.json"

# French overseas departments - Ember (via ISO 3166-1) gives these their own
# plain alpha-2 code (GF, GP, MQ, RE), but this app's own map geometry
# splits them out as exclaves of France under "FR-XX" codes instead (see
# scripts/build_geometry.py's EXCLAVES and the root README's "Overseas
# exclaves" section) - remapped here so their real data actually lands on
# a mappable jurisdiction rather than silently going nowhere.
FR_EXCLAVE_REMAP = {"GF": "FR-GF", "GP": "FR-GP", "MQ": "FR-MQ", "RE": "FR-RE", "YT": "FR-YT"}


def iso3_to_iso2(iso3: str) -> str | None:
    try:
        country = pycountry.countries.get(alpha_3=iso3)
        if not country:
            return None
        return FR_EXCLAVE_REMAP.get(country.alpha_2, country.alpha_2)
    except (LookupError, AttributeError):
        return None


def download(url: str, dest: Path) -> None:
    print(f"Downloading {url} ...", file=sys.stderr)
    urllib.request.urlretrieve(url, dest)
    print(f"Saved to {dest} ({dest.stat().st_size / 1e3:.0f} KB)", file=sys.stderr)


def fetch(url: str, cache_name: str) -> Path:
    path = SCRIPTS_DIR / cache_name
    if not path.exists():
        download(url, path)
    else:
        print(f"Reusing cached download at {path}", file=sys.stderr)
    return path


def build_monthly(csv_path: Path) -> dict[str, dict]:
    """iso3 -> {name, series: [{year, month, gw}]} - GWDC only, see module docstring."""
    countries: dict[str, dict] = {}
    with csv_path.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row["Source"] != "Solar" or row["Is aggregate area"] != "0":
                continue
            if row["Unit"] != "GWDC":
                continue  # drop the parallel GWAC row - see module docstring
            iso3 = row["ISO 3 Code"]
            entry = countries.setdefault(iso3, {"name": row["Area"], "series": []})
            entry["series"].append(
                {"year": int(row["Year"]), "month": int(row["Month"]), "gw": float(row["Installed Capacity"])}
            )
    for entry in countries.values():
        entry["series"].sort(key=lambda r: (r["year"], r["month"]))
    return countries


def build_annual(csv_path: Path) -> dict[str, dict]:
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
    monthly_csv = fetch(MONTHLY_URL, "_ember_capacity_download_cache.csv")
    annual_csv = fetch(ANNUAL_URL, "_ember_generation_yearly_download_cache.csv")

    monthly = build_monthly(monthly_csv)
    annual = build_annual(annual_csv)
    countries, unmapped = combine(monthly, annual)

    if unmapped:
        print(f"WARNING: no ISO2 mapping for {sorted(unmapped)}", file=sys.stderr)

    monthly_n = sum(1 for c in countries.values() if c["granularity"] == "monthly")
    annual_n = len(countries) - monthly_n
    report_new_countries(OUT_PATH, set(countries.keys()))

    output = {
        "source": {"monthly": MONTHLY_URL, "annual": ANNUAL_URL},
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "note": (
            "Solar installed capacity (GW). Each country takes whichever "
            "source's own latest point is more recent: the monthly file "
            "(DC nameplate rating, ~monthly cadence, 25 countries) or the "
            "yearly file's own Capacity (GW) column (one point a year, "
            "wider coverage). A country's entry is either "
            '"granularity": "monthly" with a `series` of {year, month, gw} '
            'points, or "granularity": "annual" with an `annualSeries` of '
            "{year, gw} points - never both."
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
