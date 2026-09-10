#!/usr/bin/env python3
"""Collapse Australia, the US and Canada from their states/provinces down to
one country-level shape each, for this app specifically.

`ep_policymap` deliberately keeps these three subdivided (its whole point is
policy, which genuinely varies state by state there). This app only has one
national number per country (dummy or Ember, neither has a state-level
breakdown), so drawing 8/54/13 identically-coloured state polygons per
country was always going to look wrong and needed the resolveTargets/
canonicalCode workaround in lib/jurisdictions.ts just to click and colour
correctly. A real country-level shape removes the need for that workaround
entirely (though the code is left in place, now a no-op for these three, in
case a future dataset reintroduces a genuinely subdivided country).

This rewrites src/assets/jurisdictions.geojson (dissolves each country's
child features into one, via shapely's union) and src/data/jurisdictions.json
(flips `mappable` to true for AU/US/CA) **in place** - re-run only if the
geometry is ever re-copied fresh from ep_policymap and needs the same
treatment again.

    python3 scripts/dissolve_subdivided.py
"""

import json
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
GEOJSON_PATH = ROOT / "src" / "assets" / "jurisdictions.geojson"
INDEX_PATH = ROOT / "src" / "data" / "jurisdictions.json"

TO_DISSOLVE = ["AU", "US", "CA"]


def main() -> None:
    geojson = json.loads(GEOJSON_PATH.read_text())
    index = json.loads(INDEX_PATH.read_text())

    children_by_parent: dict[str, list[str]] = {}
    for entry in index:
        if entry["parent"]:
            children_by_parent.setdefault(entry["parent"], []).append(entry["code"])

    for country_code in TO_DISSOLVE:
        children = set(children_by_parent.get(country_code, []))
        if not children:
            print(f"WARNING: no children found for {country_code}, skipping")
            continue

        matching = [f for f in geojson["features"] if f["properties"].get("code") in children]
        if not matching:
            print(f"WARNING: no matching features for {country_code}'s children, skipping")
            continue

        merged = unary_union([shape(f["geometry"]) for f in matching])
        dissolved_feature = {
            "type": "Feature",
            "properties": {"code": country_code},
            "geometry": mapping(merged),
        }

        geojson["features"] = [f for f in geojson["features"] if f["properties"].get("code") not in children]
        geojson["features"].append(dissolved_feature)
        print(f"{country_code}: dissolved {len(matching)} features into one")

        for entry in index:
            if entry["code"] == country_code:
                entry["mappable"] = True

    GEOJSON_PATH.write_text(json.dumps(geojson, separators=(",", ":")))
    INDEX_PATH.write_text(json.dumps(index, separators=(",", ":"), ensure_ascii=False))
    print(f"Wrote {GEOJSON_PATH} and {INDEX_PATH}")


if __name__ == "__main__":
    main()
