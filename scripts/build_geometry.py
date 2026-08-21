#!/usr/bin/env python3
"""Build the map's jurisdiction geometry from Natural Earth boundaries.

Emits src/assets/jurisdictions.geojson, in which every feature carries a
single `code` property:

  - ISO 3166-1 alpha-2 for a country          ("DE", "GB", "NZ")
  - ISO 3166-2 for a subnational jurisdiction ("AU-SA", "US-CA")

Countries that have been broken into subnational jurisdictions are dropped as
whole-country features, so the map never draws a country on top of its own
states. Which countries those are is set by SUBDIVIDED below.

This replaces the grid-level world.geojson inherited from GridSim, which split
countries by balancing authority (Malaysia in two, the US into 55 BAs) — the
right geometry for a grid simulator and the wrong one for a policy map.

Source data is Natural Earth (public domain), fetched at build time:
  https://github.com/nvkelso/natural-earth-vector
"""

import json
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "src" / "assets" / "jurisdictions.geojson"
INDEX = REPO / "src" / "data" / "jurisdictions.json"
CACHE = REPO / ".cache"

BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
ADMIN0 = "ne_50m_admin_0_countries.geojson"
ADMIN1 = "ne_50m_admin_1_states_provinces.geojson"

# Countries represented by their subnational jurisdictions rather than as a
# single shape. Australia because its market rules diverge by region and NEM/WEM
# has no clean boundary of its own; the US because essentially all of the
# Protocol's subject matter is set at state level.
SUBDIVIDED = {"AU", "US"}

# Natural Earth carries placeholder codes for a handful of dependencies and
# disputed areas. Anything without a real two-letter code is not scoreable.
BAD_CODES = {"-99", "", None}

# Territories that are not their own electricity jurisdiction.
SKIP_ADMIN1 = {"AU-X02~"}  # Jervis Bay Territory


def fetch(name: str) -> dict:
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists():
        url = f"{BASE}/{name}"
        print(f"downloading {url}")
        urllib.request.urlretrieve(url, path)
    return json.loads(path.read_text())


def main() -> None:
    admin0 = fetch(ADMIN0)
    admin1 = fetch(ADMIN1)

    features = []
    seen: set[str] = set()
    # Subdivided countries get no shape of their own, but still need an index
    # entry so their states can name their parent.
    parents = []

    for f in admin0["features"]:
        props = f["properties"]
        # ISO_A2 is "-99" for France and Norway among others; the _EH variant
        # carries the code actually in use.
        code = props.get("ISO_A2_EH") or props.get("ISO_A2")
        if code in BAD_CODES:
            continue
        if code in SUBDIVIDED:
            # Natural Earth lists external territories under the sovereign's
            # code too (Ashmore and Cartier under AU). The first entry is the
            # country proper; the rest are not separate jurisdictions.
            if any(x["code"] == code for x in parents):
                continue
            parents.append(
                {
                    "code": code,
                    "name": props.get("NAME_LONG") or props.get("NAME"),
                    "level": "country",
                    "parent": None,
                    "region": props.get("SUBREGION") or props.get("REGION_UN"),
                    "mappable": False,
                }
            )
            continue
        if code in seen:
            print(f"  warning: duplicate country {code}, keeping the first")
            continue
        seen.add(code)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "code": code,
                    "name": props.get("NAME_LONG") or props.get("NAME"),
                    "level": "country",
                    "parent": None,
                    "region": props.get("SUBREGION") or props.get("REGION_UN"),
                },
                "geometry": f["geometry"],
            }
        )

    subnational = 0
    for f in admin1["features"]:
        props = f["properties"]
        parent = props.get("iso_a2")
        code = props.get("iso_3166_2")
        if parent not in SUBDIVIDED or code in SKIP_ADMIN1 or code in BAD_CODES:
            continue
        if code in seen:
            print(f"  warning: duplicate jurisdiction {code}, keeping the first")
            continue
        seen.add(code)
        subnational += 1
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "code": code,
                    "name": props.get("name"),
                    "level": "subnational",
                    "parent": parent,
                    "region": props.get("admin"),
                },
                "geometry": f["geometry"],
            }
        )

    for country in SUBDIVIDED:
        if not any(p["properties"]["parent"] == country for p in features):
            sys.exit(f"{country} is marked subdivided but no states were found")

    out = {"type": "FeatureCollection", "features": features}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))

    # A lightweight index of the same jurisdictions, so the app can resolve
    # names and parentage without parsing megabytes of geometry.
    index = sorted(
        [{**f["properties"], "mappable": True} for f in features] + parents,
        key=lambda p: (p["level"] != "country", p["code"]),
    )
    INDEX.write_text(json.dumps(index, indent=2) + "\n")

    size = OUT.stat().st_size / 1_000_000
    countries = len(features) - subnational
    print(f"wrote {OUT.relative_to(REPO)} ({size:.1f} MB)")
    print(f"  {countries} countries, {subnational} subnational jurisdictions")
    print(f"wrote {INDEX.relative_to(REPO)}")


if __name__ == "__main__":
    main()
