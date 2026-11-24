"""Tests for the Solar Homes Calculator's data in the `calculator` schema (ep_db/calculator_import.py).

Uses the same disposable Postgres as test_ep_db.py (EP_TEST_DATABASE_URL), and its `db` fixture.
"""

import copy

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ep_db import calculator_import
from ep_db.calculator_import import annual_sum, check, country_entry, export_all, import_all, load_files, summary
from ep_db.import_json import DataError, differences
from ep_db.models import CountryIrradianceRow
from test_ep_db import api_client, db, needs_db  # noqa: F401 - pytest fixtures


@pytest.fixture(scope="module")
def files():
    return load_files()


def run_import(engine, files):
    with Session(engine) as session, session.begin():
        return import_all(session, files, actor="test")


def test_annual_sum_matches_a_left_to_right_float_sum():
    values = [0.1] * 10 + [1e16, 1.0, -1e16]
    expected = 0.0
    for v in values:
        expected += v
    assert annual_sum(values) == expected  # not math.fsum, which the browser doesn't use


@needs_db
def test_import_round_trips_the_real_files(db, files):
    result = run_import(db, files)
    assert result["irradiance_countries"] == len(files["irradiance"])
    with Session(db) as session:
        assert check(session, files) == []


@needs_db
def test_summary_has_every_country_without_profiles(db, files):
    run_import(db, files)
    with Session(db) as session:
        s = summary(session)
    assert list(s["index"]) == list(files["irradiance"])
    code = next(iter(files["irradiance"]))
    entry = s["index"][code]
    assert set(entry) == {"lat", "lon", "tiltDeg", "azimuthDeg", "annualKWhPerKWp"}
    assert entry["annualKWhPerKWp"] == annual_sum(files["irradiance"][code]["profileWPerWp"])
    assert s["selfSufficiency"] == files["selfSufficiency"]
    assert s["pc1DemandProfile"] == files["pc1"]


@needs_db
def test_country_entry(db, files):
    run_import(db, files)
    code = next(iter(files["irradiance"]))
    with Session(db) as session:
        assert differences(files["irradiance"][code], country_entry(session, code.lower())) == []
        assert country_entry(session, "ZZ") is None


@needs_db
def test_short_profile_fails_and_writes_nothing(db, files):
    run_import(db, files)
    bad = copy.deepcopy(files)
    code = next(iter(bad["irradiance"]))
    bad["irradiance"][code]["profileWPerWp"] = bad["irradiance"][code]["profileWPerWp"][:-1]
    with pytest.raises(DataError, match="8760"):
        run_import(db, bad)
    with Session(db) as session:
        assert session.scalar(select(func.count()).select_from(CountryIrradianceRow)) == len(files["irradiance"])


@needs_db
def test_check_reports_a_changed_tier(db, files):
    run_import(db, files)
    changed = copy.deepcopy(files)
    code = next(iter(changed["selfSufficiency"]))
    changed["selfSufficiency"][code]["medium"] += 1
    with Session(db) as session:
        diffs = check(session, changed)
    assert diffs == [f".selfSufficiency.{code}.medium: file {files['selfSufficiency'][code]['medium'] + 1}, database {files['selfSufficiency'][code]['medium']}"]


def test_api_without_a_database_is_unavailable(api_client, monkeypatch):  # noqa: F811
    monkeypatch.delenv("DATABASE_URL", raising=False)
    for path in ("/api/calculator/summary", "/api/calculator/irradiance", "/api/calculator/irradiance/GB"):
        r = api_client.get(path)
        assert r.status_code == 503, path
        assert r.headers["cache-control"] == "no-store"


@needs_db
def test_api_on_an_empty_database_is_unavailable(db, api_client):  # noqa: F811
    r = api_client.get("/api/calculator/summary")
    assert r.status_code == 503
    assert "hasn't been imported" in r.json()["error"]


@needs_db
def test_api_serves_the_files(db, files, api_client):  # noqa: F811
    run_import(db, files)
    all_ = api_client.get("/api/calculator/irradiance")
    assert all_.status_code == 200 and "public" in all_.headers["cache-control"]
    assert differences(files["irradiance"], all_.json()) == []
    code = next(iter(files["irradiance"]))
    one = api_client.get(f"/api/calculator/irradiance/{code}")
    assert one.status_code == 200
    assert differences(files["irradiance"][code], one.json()) == []
    assert api_client.get("/api/calculator/irradiance/ZZ").status_code == 404
    assert api_client.get("/api/calculator/irradiance/a.b").status_code == 404
    assert api_client.get("/api/calculator/summary").status_code == 200


@needs_db
def test_api_is_built_once_and_readable_without_gzip(db, files, api_client, monkeypatch):  # noqa: F811
    run_import(db, files)
    calls = []
    real = calculator_import.irradiance_all
    monkeypatch.setattr(calculator_import, "irradiance_all", lambda s: calls.append(1) or real(s))
    for i in range(3):
        r = api_client.get(f"/api/calculator/irradiance?x={i}")
        assert r.status_code == 200 and list(r.json()) == list(files["irradiance"])
        assert r.headers["content-encoding"] == "gzip"
    plain = api_client.get("/api/calculator/irradiance", headers={"Accept-Encoding": "identity"})
    assert "content-encoding" not in plain.headers and plain.json() == r.json()
    assert len(calls) == 1
