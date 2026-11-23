"""Load the Deployment Explorer's data into the `deployment` schema of the Electric Futures database.

    cd klute/gate
    DATABASE_URL=postgresql+psycopg://... python -m ep_db.deployment_import            # import
    DATABASE_URL=postgresql+psycopg://... python -m ep_db.deployment_import --check    # compare only

Reads `deployment/src/data/ember_solar.json`, `ember_generation.json` and `population.json` - the
files `deployment/scripts/build_*.py` write from Ember's API and the World Bank. Nobody edits this
data by hand, so every run replaces all of it, in one transaction: a failed run leaves the
database as it was. Any key the script doesn't know about fails the run rather than being dropped.

`--check` writes nothing: it rebuilds the three files' shapes from the database (`export_all`, the
same function GET /api/deployment/data serves) and fails if they differ from the files.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from ep_db.db import database_url, engine
from ep_db.import_json import DataError, _keys, differences
from ep_db.models import (
    AuditLog,
    DeploymentDataset,
    GenerationCountry,
    GenerationYearly,
    Population,
    SolarAnnual,
    SolarCountry,
    SolarMonthly,
)

FILES = {"solar": "ember_solar.json", "generation": "ember_generation.json", "population": "population.json"}
TOP_LEVEL = {"source", "fetchedAt", "note", "countries"}


def default_data_dir() -> Path:
    """`deployment/src/data` in this repo. Only worked out when needed: the gate's image holds
    ep_db without the repo around it."""
    return Path(__file__).resolve().parents[3] / "deployment" / "src" / "data"


def load_files(data_dir: Path | None = None) -> dict[str, Any]:
    data_dir = data_dir or default_data_dir()
    return {name: json.loads((data_dir / file).read_text()) for name, file in FILES.items()}


# --- Import -------------------------------------------------------------------------------------


def _countries(data: dict, name: str) -> dict[str, dict]:
    _keys(data, TOP_LEVEL, set(), FILES[name])
    countries = data["countries"]
    if not isinstance(countries, dict) or not countries:
        raise DataError(f"{FILES[name]}: `countries` must be a non-empty object")
    return countries


def import_all(session: Session, files: dict[str, Any], *, actor: str) -> dict[str, int]:
    """Replace every deployment table with the files' contents. The caller owns the transaction."""
    solar = _countries(files["solar"], "solar")
    generation = _countries(files["generation"], "generation")
    population = _countries(files["population"], "population")

    for model in (SolarMonthly, SolarAnnual, SolarCountry, GenerationYearly, GenerationCountry, Population, DeploymentDataset):
        session.execute(delete(model))

    for name in FILES:
        f = files[name]
        session.add(DeploymentDataset(name=name, source=f["source"], fetched_at=f["fetchedAt"], note=f["note"], imported_by=actor))

    counts = {"solar_monthly": 0, "solar_annual": 0, "generation_yearly": 0}
    for position, (code, c) in enumerate(solar.items()):
        where = f"{FILES['solar']} {code}"
        if c.get("granularity") == "monthly":
            _keys(c, {"name", "granularity", "series"}, set(), where)
        elif c.get("granularity") == "annual":
            _keys(c, {"name", "granularity", "annualSeries"}, set(), where)
        else:
            raise DataError(f"{where}: granularity must be 'monthly' or 'annual', not {c.get('granularity')!r}")
        session.add(SolarCountry(code=code, position=position, name=c["name"], granularity=c["granularity"]))
    session.flush()
    for code, c in solar.items():
        where = f"{FILES['solar']} {code}"
        for p in c.get("series", []):
            _keys(p, {"year", "month", "gw"}, set(), where)
            session.add(SolarMonthly(code=code, year=p["year"], month=p["month"], gw=p["gw"]))
            counts["solar_monthly"] += 1
        for p in c.get("annualSeries", []):
            _keys(p, {"year", "gw"}, set(), where)
            session.add(SolarAnnual(code=code, year=p["year"], gw=p["gw"]))
            counts["solar_annual"] += 1

    for position, (code, c) in enumerate(generation.items()):
        _keys(c, {"name", "series"}, set(), f"{FILES['generation']} {code}")
        session.add(GenerationCountry(code=code, position=position, name=c["name"]))
    session.flush()
    for code, c in generation.items():
        for p in c["series"]:
            _keys(p, {"year", "solarTWh", "totalTWh", "sharePct"}, set(), f"{FILES['generation']} {code}")
            session.add(
                GenerationYearly(code=code, year=p["year"], solar_twh=p["solarTWh"], total_twh=p["totalTWh"], share_pct=p["sharePct"])
            )
            counts["generation_yearly"] += 1

    for position, (code, c) in enumerate(population.items()):
        _keys(c, {"name", "populationMillions", "year"}, {"source"}, f"{FILES['population']} {code}")
        session.add(
            Population(
                code=code,
                position=position,
                name=c["name"],
                population_millions=c["populationMillions"],
                year=c["year"],
                source=c.get("source"),
            )
        )

    summary = {
        "solar_countries": len(solar),
        **counts,
        "generation_countries": len(generation),
        "population": len(population),
    }
    session.add(
        AuditLog(
            actor=actor,
            entity="deployment_data",
            entity_key="all",
            action="import",
            after=summary | {"fetchedAt": {name: files[name]["fetchedAt"] for name in FILES}},
        )
    )
    session.flush()
    return summary


# --- Export / check -----------------------------------------------------------------------------


def export_all(session: Session) -> dict[str, Any]:
    """The three files' shapes, rebuilt from the database. Raises DataError if it was never imported."""
    meta = {d.name: d for d in session.scalars(select(DeploymentDataset))}
    if set(meta) != set(FILES):
        raise DataError("The deployment data hasn't been imported into this database.")

    def top(name: str, countries: dict) -> dict:
        d = meta[name]
        return {"source": d.source, "fetchedAt": d.fetched_at, "note": d.note, "countries": countries}

    monthly: dict[str, list] = {}
    for p in session.scalars(select(SolarMonthly).order_by(SolarMonthly.code, SolarMonthly.year, SolarMonthly.month)):
        monthly.setdefault(p.code, []).append({"year": p.year, "month": p.month, "gw": p.gw})
    annual: dict[str, list] = {}
    for p in session.scalars(select(SolarAnnual).order_by(SolarAnnual.code, SolarAnnual.year)):
        annual.setdefault(p.code, []).append({"year": p.year, "gw": p.gw})
    solar = {}
    for c in session.scalars(select(SolarCountry).order_by(SolarCountry.position)):
        if c.granularity == "monthly":
            solar[c.code] = {"name": c.name, "granularity": "monthly", "series": monthly.get(c.code, [])}
        else:
            solar[c.code] = {"name": c.name, "granularity": "annual", "annualSeries": annual.get(c.code, [])}

    yearly: dict[str, list] = {}
    for p in session.scalars(select(GenerationYearly).order_by(GenerationYearly.code, GenerationYearly.year)):
        yearly.setdefault(p.code, []).append(
            {"year": p.year, "solarTWh": p.solar_twh, "totalTWh": p.total_twh, "sharePct": p.share_pct}
        )
    generation = {
        c.code: {"name": c.name, "series": yearly.get(c.code, [])}
        for c in session.scalars(select(GenerationCountry).order_by(GenerationCountry.position))
    }

    population = {
        p.code: {"name": p.name, "populationMillions": p.population_millions, "year": p.year}
        | ({"source": p.source} if p.source is not None else {})
        for p in session.scalars(select(Population).order_by(Population.position))
    }

    return {"solar": top("solar", solar), "generation": top("generation", generation), "population": top("population", population)}


def check(session: Session, files: dict[str, Any]) -> list[str]:
    actual = export_all(session)
    diffs = differences(files, actual)
    # differences() ignores dict key order, but the frontend lists countries in key order.
    for name in FILES:
        if list(files[name]["countries"]) != list(actual[name]["countries"]):
            diffs.append(f".{name}.countries: key order differs from the file")
    return diffs


# --- CLI ----------------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--data-dir", type=Path, help="default: deployment/src/data in this repo")
    parser.add_argument("--check", action="store_true", help="compare the database with the files; write nothing")
    parser.add_argument("--actor", default=os.environ.get("USER", "deployment_import"), help="recorded in audit_log")
    args = parser.parse_args(argv)

    url = make_url(database_url())
    print(f"Database: {url.host}:{url.port or 5432}/{url.database} as {url.username}", file=sys.stderr)
    files = load_files(args.data_dir)

    try:
        with Session(engine()) as session:
            if args.check:
                diffs = check(session, files)
                for d in diffs[:50]:
                    print(d)
                if len(diffs) > 50:
                    print(f"... and {len(diffs) - 50} more")
                print("Matches the JSON files." if not diffs else f"{len(diffs)} differences.", file=sys.stderr)
                return 1 if diffs else 0

            with session.begin():
                summary = import_all(session, files, actor=args.actor)
            print(json.dumps(summary, indent=2))
            return 0
    except DataError as e:
        print(f"Import failed, nothing written: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
