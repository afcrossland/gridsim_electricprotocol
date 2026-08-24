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
countries by balancing authority (Malaysia in two, the US into 55 BAs) - the
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
# has no clean boundary of its own; the US and Canada because essentially all of
# the Protocol's subject matter is set at state or provincial level - Canadian
# electricity is a provincial competence, with each province running its own
# utility, net metering rules and building code adoption.
SUBDIVIDED = {"AU", "US", "CA"}

# Natural Earth carries placeholder codes for a handful of dependencies and
# disputed areas. Anything without a real two-letter code is not scoreable.
BAD_CODES = {"-99", "", None}

# Not a scoreable electricity jurisdiction under any government - excluded
# entirely rather than just left out of app-level filters, so it never
# appears on the map, in search, or in any jurisdiction dropdown.
SKIP_COUNTRIES = {"AQ"}  # Antarctica

# Territories that are not their own electricity jurisdiction.
SKIP_ADMIN1 = {"AU-X02~"}  # Jervis Bay Territory

# Full ISO 3166-1 alpha-2 countries in their own right in Natural Earth's
# admin0 layer (each has its own polygon and its own code, unlike a US state,
# which only exists in the admin1 layer) - but each is a US insular area with
# its own local electricity utility and regulator, not the mainland grid, so
# grouped under "US" the same way a state is rather than left as an ordinary
# independent country. Level "subnational" and parent "US" here is exactly
# the shape a state gets from the admin1 loop below; only the source layer
# differs.
#
# Grouping them under "US" means a federal-level answer written for "US" is
# now inherited by these three too (see resolveTargets/childrenOf), which is
# a real simplification worth flagging when researching: insular territories
# often have distinct tax and customs treatment from the mainland (Puerto
# Rico runs its own tax system, for one), so an inherited federal score here
# is a starting assumption, not a verified one - the same caveat any
# inherited answer already carries, just easy to forget for a territory.
US_TERRITORIES = {"PR", "GU", "AS"}

# Countries whose country-level polygon includes a distant, disjoint overseas
# territory that runs its own electricity regime - clicking French Guiana
# selected "FR" and showed metropolitan France's directive-baseline EU
# answers, none of which apply to an isolated non-interconnected grid outside
# the European synchronous system. Each exclave is pulled out into its own
# mappable, separately-scored jurisdiction (level "subnational", parent the
# sovereign's code) instead.
#
# Detected by testing the centroid of every part of a country's MultiPolygon
# against the given lon/lat window; any part not claimed by an exclave stays
# with the country. Only France is split today. Natural Earth's admin-0 layer
# shows the same shape - one polygon spanning a mainland and a distant
# territory - for Norway (Svalbard), the Netherlands (the Caribbean
# municipalities) and Chile (Easter Island), which are not yet split; revisit
# if answers ever get written for those specifically.
EXCLAVES: dict[str, list[dict]] = {
    "FR": [
        {"code": "FR-GF", "name": "French Guiana", "bounds": (-60, -48, 0, 8)},
        {"code": "FR-GP", "name": "Guadeloupe", "bounds": (-62, -60.5, 15.5, 16.6)},
        {"code": "FR-MQ", "name": "Martinique", "bounds": (-61.5, -60.5, 14.2, 15.0)},
        {"code": "FR-RE", "name": "Réunion", "bounds": (54.8, 56.0, -21.6, -20.7)},
        {"code": "FR-YT", "name": "Mayotte", "bounds": (44.8, 45.4, -13.2, -12.5)},
    ],
}


def split_exclaves(code: str, geometry: dict) -> tuple[dict, list[dict]]:
    """Pull a country's EXCLAVES-listed territories out of its MultiPolygon.

    Returns the remaining (mainland) geometry and a list of exclave dicts with
    their own code, name and geometry. A part with no match stays attached to
    the mainland, so an exclave with bounds that miss its actual geometry
    fails safe: France keeps the territory rather than losing it.
    """
    defs = EXCLAVES.get(code)
    if not defs or geometry["type"] != "MultiPolygon":
        return geometry, []

    remaining_parts = []
    claimed: dict[str, list] = {d["code"]: [] for d in defs}

    for part in geometry["coordinates"]:
        ring = part[0]
        lons = [p[0] for p in ring]
        lats = [p[1] for p in ring]
        cx, cy = sum(lons) / len(lons), sum(lats) / len(lats)

        match = next(
            (
                d["code"]
                for d in defs
                if d["bounds"][0] <= cx <= d["bounds"][1] and d["bounds"][2] <= cy <= d["bounds"][3]
            ),
            None,
        )
        (claimed[match] if match else remaining_parts).append(part)

    exclaves = [
        {"code": d["code"], "name": d["name"], "geometry": {"type": "MultiPolygon", "coordinates": claimed[d["code"]]}}
        for d in defs
        if claimed[d["code"]]
    ]
    return {"type": "MultiPolygon", "coordinates": remaining_parts}, exclaves


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
        if code in BAD_CODES or code in SKIP_COUNTRIES:
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

        country_name = props.get("NAME_LONG") or props.get("NAME")
        geometry, exclaves = split_exclaves(code, f["geometry"])
        if exclaves:
            print(f"  split {code}: {', '.join(e['code'] for e in exclaves)}")

        is_us_territory = code in US_TERRITORIES
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "code": code,
                    "name": country_name,
                    "level": "subnational" if is_us_territory else "country",
                    "parent": "US" if is_us_territory else None,
                    "region": (
                        "United States of America"
                        if is_us_territory
                        else (props.get("SUBREGION") or props.get("REGION_UN"))
                    ),
                },
                "geometry": geometry,
            }
        )

        for exclave in exclaves:
            seen.add(exclave["code"])
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "code": exclave["code"],
                        "name": exclave["name"],
                        "level": "subnational",
                        "parent": code,
                        "region": country_name,
                    },
                    "geometry": exclave["geometry"],
                }
            )

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
    # Derived from the final feature list rather than tracked incrementally,
    # since subnational features now come from two sources - the admin1 states
    # loop and exclave splitting - and a running counter would need updating
    # in both places every time either changes.
    countries = sum(1 for f in features if f["properties"]["level"] == "country")
    subnational = sum(1 for f in features if f["properties"]["level"] == "subnational")
    print(f"wrote {OUT.relative_to(REPO)} ({size:.1f} MB)")
    print(f"  {countries} countries, {subnational} subnational jurisdictions")
    print(f"wrote {INDEX.relative_to(REPO)}")


if __name__ == "__main__":
    main()
