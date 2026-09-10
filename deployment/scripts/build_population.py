#!/usr/bin/env python3
"""Build src/data/population.json - real population figures, replacing the
population numbers that used to live in src/data/dummyDeployment.ts (deleted
2026-09-09 along with the rest of that file's fabricated numbers). Needed
for the "Installed capacity per capita" metric to keep working on real data.

Source: World Bank Open Data, indicator SP.POP.TOTL (Population, total),
most recent non-null value per country - the same free, no-key API this
project family already uses for population elsewhere (see ep_policymap's
own indicator-answers.json).

    https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&mrnev=1

The World Bank's country list mixes real countries with regional/income-
group aggregates ("World", "OECD members", "Arab World", ...), which don't
have a jurisdiction of their own on this app's map - filtered out by
keeping only codes that exist as a country-level entry in
src/data/jurisdictions.json, rather than trying to guess at aggregate-vs-
country from the World Bank response's own fields alone.

**Taiwan (TW) is the one real, mapped country missing from this filter** -
the World Bank does not publish a population figure for Taiwan under its
own code (a political, not data, gap). Hand-added below from Taiwan's own
National Statistics agency (23.42 million, 2024 estimate,
https://www.stat.gov.tw) rather than left blank, since Taiwan has real
Ember capacity data and would otherwise silently lose its per-capita
figure.

Usage: one-time read, like the two Ember importers -
    python3 scripts/build_population.py
"""

import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = (
    "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL"
    "?format=json&per_page=20000&mrnev=1"
)

ROOT = Path(__file__).resolve().parent.parent
JURISDICTIONS_PATH = ROOT / "src" / "data" / "jurisdictions.json"
OUT_PATH = ROOT / "src" / "data" / "population.json"

# See docstring - not in the World Bank's own SP.POP.TOTL response.
MANUAL_ADDITIONS = {
    "TW": {"name": "Taiwan", "populationMillions": 23.42, "year": 2024, "source": "Taiwan National Statistics (stat.gov.tw)"},
}


def fetch(url: str, cache_path: Path) -> list:
    if cache_path.exists():
        print(f"Reusing cached download at {cache_path}", file=sys.stderr)
        return json.loads(cache_path.read_text())[1]
    print(f"Fetching {url} ...", file=sys.stderr)
    with urllib.request.urlopen(url) as resp:
        payload = json.load(resp)
    cache_path.write_text(json.dumps(payload))
    return payload[1]


def report_new_countries(out_path: Path, new_codes: set[str]) -> None:
    """Diffs against the previous build's own output, if one exists, and
    flags any country code that wasn't there before - added 2026-09-10 so a
    country the World Bank newly starts publishing a population figure for
    doesn't go unnoticed just because re-running this script by hand looks
    the same either way."""
    if not out_path.exists():
        return
    old_codes = set(json.loads(out_path.read_text()).get("countries", {}).keys())
    added = new_codes - old_codes
    if added:
        print(f"NEW COUNTRIES since last build: {sorted(added)}", file=sys.stderr)
    else:
        print("No new countries since last build.", file=sys.stderr)


def main() -> None:
    country_codes = {
        j["code"] for j in json.loads(JURISDICTIONS_PATH.read_text()) if j["level"] == "country"
    }

    cache_path = Path(__file__).resolve().parent / "_population_download_cache.json"
    rows = fetch(SOURCE_URL, cache_path)
    countries: dict[str, dict] = {}
    for row in rows:
        code = row["country"]["id"]
        if code not in country_codes or row["value"] is None:
            continue
        countries[code] = {
            "name": row["country"]["value"],
            "populationMillions": round(row["value"] / 1_000_000, 3),
            "year": int(row["date"]),
        }

    for code, entry in MANUAL_ADDITIONS.items():
        countries[code] = entry

    report_new_countries(OUT_PATH, set(countries.keys()))

    output = {
        "source": SOURCE_URL,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "note": (
            "World Bank SP.POP.TOTL, most recent value per country, filtered "
            "to jurisdictions.json's own country list. Taiwan is hand-added "
            "from Taiwan's own National Statistics agency - see this "
            "script's docstring."
        ),
        "countries": countries,
    }

    OUT_PATH.write_text(json.dumps(output, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} - {len(countries)} countries", file=sys.stderr)


if __name__ == "__main__":
    main()
