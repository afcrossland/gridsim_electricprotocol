"""Tests for the Deployment Explorer's data in the `deployment` schema (ep_db/deployment_import.py).

Uses the same disposable Postgres as test_ep_db.py (EP_TEST_DATABASE_URL), and its `db` fixture.
"""

import copy

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ep_db.deployment_import import check, export_all, import_all, load_files
from ep_db.import_json import DataError, differences
from ep_db.models import AuditLog, Population, SolarCountry
from test_ep_db import api_client, db, needs_db  # noqa: F401 - pytest fixtures


@pytest.fixture
def files():
    return load_files()


def run_import(engine, files):
    with Session(engine) as session, session.begin():
        return import_all(session, files, actor="test")


def test_real_files_have_the_expected_shape(files):
    assert set(files) == {"solar", "generation", "population"}
    for f in files.values():
        assert set(f) == {"source", "fetchedAt", "note", "countries"}


@needs_db
def test_import_round_trips_the_real_files(db, files):
    summary = run_import(db, files)
    assert summary["solar_countries"] == len(files["solar"]["countries"])
    assert summary["population"] == len(files["population"]["countries"])
    with Session(db) as session:
        assert check(session, files) == []
        # Key order is what the explorer lists countries in.
        exported = export_all(session)
        for name in files:
            assert list(exported[name]["countries"]) == list(files[name]["countries"])


@needs_db
def test_reimport_replaces_everything(db, files):
    run_import(db, files)
    fewer = copy.deepcopy(files)
    keep = list(fewer["population"]["countries"])[:3]
    fewer["population"]["countries"] = {k: fewer["population"]["countries"][k] for k in keep}
    run_import(db, fewer)
    with Session(db) as session:
        assert session.scalar(select(func.count()).select_from(Population)) == 3
        assert check(session, fewer) == []
        assert check(session, files) != []
        assert len(session.scalars(select(AuditLog).where(AuditLog.entity == "deployment_data")).all()) == 2


@needs_db
def test_check_reports_a_changed_value(db, files):
    run_import(db, files)
    changed = copy.deepcopy(files)
    code = next(iter(changed["generation"]["countries"]))
    changed["generation"]["countries"][code]["series"][0]["sharePct"] += 1
    with Session(db) as session:
        diffs = check(session, changed)
    assert len(diffs) == 1 and diffs[0].startswith(f".generation.countries.{code}.series[0].sharePct")


@needs_db
def test_unknown_key_fails_and_writes_nothing(db, files):
    run_import(db, files)
    bad = copy.deepcopy(files)
    code = next(iter(bad["solar"]["countries"]))
    bad["solar"]["countries"][code]["rooftopGw"] = 1.0
    with pytest.raises(DataError, match="unknown"):
        run_import(db, bad)
    with Session(db) as session:
        assert session.scalar(select(func.count()).select_from(SolarCountry)) == len(files["solar"]["countries"])
        assert check(session, files) == []


def test_api_without_a_database_is_unavailable(api_client, monkeypatch):  # noqa: F811
    monkeypatch.delenv("DATABASE_URL", raising=False)
    r = api_client.get("/api/deployment/data")
    assert r.status_code == 503
    assert r.headers["cache-control"] == "no-store"


@needs_db
def test_api_on_an_empty_database_is_unavailable(db, api_client):  # noqa: F811
    r = api_client.get("/api/deployment/data")
    assert r.status_code == 503
    assert "hasn't been imported" in r.json()["error"]


@needs_db
def test_api_serves_exactly_what_the_files_hold(db, files, api_client):  # noqa: F811
    run_import(db, files)
    r = api_client.get("/api/deployment/data")
    assert r.status_code == 200
    assert "public" in r.headers["cache-control"]
    body = r.json()
    assert differences(files, body) == []
    assert list(body["solar"]["countries"]) == list(files["solar"]["countries"])
