"""Load the Solar Homes Calculator's data into the `calculator` schema of the Electric Futures database.

    cd klute/gate
    DATABASE_URL=postgresql+psycopg://... python -m ep_db.calculator_import            # import
    DATABASE_URL=postgresql+psycopg://... python -m ep_db.calculator_import --check    # compare only

Reads `calculator/src/data/country-irradiance.json`, `country-self-sufficiency.json` and
`pc1-demand-profile.json` - the files `npm run calculator:build-datasets` writes. Nobody edits this
data by hand, so every run replaces all of it, in one transaction. Any key the script doesn't know
about, or a profile that isn't 8760 hours long, fails the run.

`--check` writes nothing: it rebuilds the three files' shapes from the database (`export_all`) and
fails if they differ from the files, key order included.

The API (ep_db/api.py) serves this three ways, so the browser downloads only what it needs:
`summary()` (every country's point, orientation and annual kWh/kWp, plus the self-sufficiency
tiers and the demand shape - about 0.2 MB), `country_entry()` (one country's full profile), and
`export_all()["irradiance"]` (every profile, for the members' global simulator).
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
from ep_db.models import AuditLog, CountryIrradianceRow, DemandProfileRow, SelfSufficiencyRow

FILES = {
    "irradiance": "country-irradiance.json",
    "selfSufficiency": "country-self-sufficiency.json",
    "pc1": "pc1-demand-profile.json",
}
HOURS = 8760


def default_data_dir() -> Path:
    """`calculator/src/data` in this repo. Only worked out when needed: the gate's image holds
    ep_db without the repo around it."""
    return Path(__file__).resolve().parents[3] / "calculator" / "src" / "data"


def load_files(data_dir: Path | None = None) -> dict[str, Any]:
    data_dir = data_dir or default_data_dir()
    return {name: json.loads((data_dir / file).read_text()) for name, file in FILES.items()}


def _profile(values: Any, where: str) -> list[float]:
    if not isinstance(values, list) or len(values) != HOURS:
        raise DataError(f"{where}: expected {HOURS} hourly values, got {len(values) if isinstance(values, list) else type(values).__name__}")
    if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values):
        raise DataError(f"{where}: every hourly value must be a number")
    return [float(v) for v in values]


def annual_sum(profile: list[float]) -> float:
    """Left-to-right float64 sum - the same arithmetic as the browser's `reduce((a, v) => a + v, 0)`."""
    total = 0.0
    for v in profile:
        total += v
    return total


# --- Import -------------------------------------------------------------------------------------


def import_all(session: Session, files: dict[str, Any], *, actor: str) -> dict[str, int]:
    """Replace every calculator table with the files' contents. The caller owns the transaction."""
    irradiance, tiers = files["irradiance"], files["selfSufficiency"]
    for name in ("irradiance", "selfSufficiency"):
        if not isinstance(files[name], dict) or not files[name]:
            raise DataError(f"{FILES[name]}: must be a non-empty object keyed by country code")
    pc1 = _profile(files["pc1"], FILES["pc1"])

    for model in (CountryIrradianceRow, SelfSufficiencyRow, DemandProfileRow):
        session.execute(delete(model))

    for position, (code, c) in enumerate(irradiance.items()):
        where = f"{FILES['irradiance']} {code}"
        _keys(c, {"lat", "lon", "tiltDeg", "azimuthDeg", "profileWPerWp"}, set(), where)
        profile = _profile(c["profileWPerWp"], where)
        session.add(
            CountryIrradianceRow(
                code=code,
                position=position,
                lat=c["lat"],
                lon=c["lon"],
                tilt_deg=c["tiltDeg"],
                azimuth_deg=c["azimuthDeg"],
                annual_kwh_per_kwp=annual_sum(profile),
                profile_w_per_wp=profile,
            )
        )
    for position, (code, t) in enumerate(tiers.items()):
        _keys(t, {"low", "medium", "high"}, set(), f"{FILES['selfSufficiency']} {code}")
        session.add(SelfSufficiencyRow(code=code, position=position, low=t["low"], medium=t["medium"], high=t["high"]))
    session.add(DemandProfileRow(name="pc1", profile=pc1))

    summary = {"irradiance_countries": len(irradiance), "self_sufficiency_countries": len(tiers), "demand_profiles": 1}
    session.add(AuditLog(actor=actor, entity="calculator_data", entity_key="all", action="import", after=summary))
    session.flush()
    return summary


# --- Export / API shapes ------------------------------------------------------------------------


def _not_imported() -> DataError:
    return DataError("The calculator data hasn't been imported into this database.")


def _entry(r: CountryIrradianceRow) -> dict[str, Any]:
    return {"lat": r.lat, "lon": r.lon, "tiltDeg": r.tilt_deg, "azimuthDeg": r.azimuth_deg, "profileWPerWp": r.profile_w_per_wp}


def _tiers(session: Session) -> dict[str, dict[str, int]]:
    return {
        t.code: {"low": t.low, "medium": t.medium, "high": t.high}
        for t in session.scalars(select(SelfSufficiencyRow).order_by(SelfSufficiencyRow.position))
    }


def _pc1(session: Session) -> list[float]:
    row = session.get(DemandProfileRow, "pc1")
    if row is None:
        raise _not_imported()
    return row.profile


def export_all(session: Session) -> dict[str, Any]:
    """The three files' shapes, rebuilt from the database. Raises DataError if it was never imported."""
    pc1 = _pc1(session)
    irradiance = {r.code: _entry(r) for r in session.scalars(select(CountryIrradianceRow).order_by(CountryIrradianceRow.position))}
    if not irradiance:
        raise _not_imported()
    return {"irradiance": irradiance, "selfSufficiency": _tiers(session), "pc1": pc1}


def summary(session: Session) -> dict[str, Any]:
    """Everything the calculator needs before a visitor picks a place, without the 8760-hour profiles."""
    pc1 = _pc1(session)
    columns = (
        CountryIrradianceRow.code,
        CountryIrradianceRow.lat,
        CountryIrradianceRow.lon,
        CountryIrradianceRow.tilt_deg,
        CountryIrradianceRow.azimuth_deg,
        CountryIrradianceRow.annual_kwh_per_kwp,
    )
    index = {
        code: {"lat": lat, "lon": lon, "tiltDeg": tilt, "azimuthDeg": az, "annualKWhPerKWp": annual}
        for code, lat, lon, tilt, az, annual in session.execute(select(*columns).order_by(CountryIrradianceRow.position))
    }
    if not index:
        raise _not_imported()
    return {"index": index, "selfSufficiency": _tiers(session), "pc1DemandProfile": pc1}


def country_entry(session: Session, code: str) -> dict[str, Any] | None:
    row = session.get(CountryIrradianceRow, code.upper())
    return _entry(row) if row else None


def check(session: Session, files: dict[str, Any]) -> list[str]:
    actual = export_all(session)
    diffs = differences(files, actual)
    for name in ("irradiance", "selfSufficiency"):
        if list(files[name]) != list(actual[name]):
            diffs.append(f".{name}: key order differs from the file")
    return diffs


# --- CLI ----------------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--data-dir", type=Path, help="default: calculator/src/data in this repo")
    parser.add_argument("--check", action="store_true", help="compare the database with the files; write nothing")
    parser.add_argument("--actor", default=os.environ.get("USER", "calculator_import"), help="recorded in audit_log")
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
                result = import_all(session, files, actor=args.actor)
            print(json.dumps(result, indent=2))
            return 0
    except DataError as e:
        print(f"Import failed, nothing written: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
