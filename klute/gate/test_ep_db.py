"""Tests for the policy database schema and JSON import (ep_db/).

The database tests need a disposable Postgres in EP_TEST_DATABASE_URL - they drop and recreate
its `policy` schema - and are skipped without one. CI provides one (see .github/workflows/ci.yml).
"""

import copy
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ep_db import import_json
from ep_db.import_json import DataError, check, differences, export_all, import_all, load_files
from ep_db.models import AuditLog, Jurisdiction, Question, Response, ResponseEvidence

HERE = Path(__file__).parent
TEST_URL = os.environ.get("EP_TEST_DATABASE_URL", "")
needs_db = pytest.mark.skipif(not TEST_URL, reason="EP_TEST_DATABASE_URL not set")


def test_differences_ignores_key_order_but_not_list_order():
    assert differences({"a": 1, "b": [1, 2]}, {"b": [1, 2], "a": 1}) == []
    assert differences({"b": [1, 2]}, {"b": [2, 1]}) == [".b[0]: file 1, database 2", ".b[1]: file 2, database 1"]
    assert differences({"x": True}, {"x": 1}) == [".x: file True, database 1"]
    assert differences({"x": 3}, {"x": 3.0}) == []
    assert differences({"x": 1}, {}) == [".x: missing from database"]


@pytest.fixture
def db(monkeypatch):
    if not TEST_URL:
        pytest.skip("EP_TEST_DATABASE_URL not set")
    monkeypatch.setenv("DATABASE_URL", TEST_URL)
    engine = create_engine(TEST_URL)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS policy CASCADE"))
    command.upgrade(Config(str(HERE / "alembic.ini")), "head")
    yield engine
    engine.dispose()


@pytest.fixture
def files():
    return load_files()


def run_import(engine, files, **kwargs):
    with Session(engine) as session, session.begin():
        return import_all(session, files, overwrite_structure=kwargs.get("overwrite_structure", False), actor="test")


@needs_db
def test_import_round_trips_the_real_files(db, files):
    summary = run_import(db, files)
    assert summary["structure"]["questions"] == len(files["protocol"]["questions"])
    with Session(db) as session:
        assert check(session, files) == []


@needs_db
def test_check_reports_a_changed_file(db, files):
    run_import(db, files)
    changed = copy.deepcopy(files)
    changed["sourced"]["answers"][0]["score"] += 1
    changed["jurisdictions"][0]["mappable"] = not changed["jurisdictions"][0]["mappable"]
    with Session(db) as session:
        diffs = check(session, changed)
    assert len(diffs) == 2
    assert any(d.startswith(".sourced.answers[0].score") for d in diffs)


@needs_db
def test_reimport_replaces_research_and_keeps_peoples_work(db, files):
    run_import(db, files)
    question_id = files["protocol"]["questions"][0]["id"]
    code = files["jurisdictions"][0]["code"]
    with Session(db) as session, session.begin():
        session.add(Response(country_code=code, question_id=question_id, score=2, updated_by="someone@example.org"))
        session.flush()
        session.add(ResponseEvidence(country_code=code, question_id=question_id, position=0, title="t", source="s", note="n"))

    fewer = copy.deepcopy(files)
    fewer["sourced"]["answers"] = fewer["sourced"]["answers"][:5]
    fewer["protocol"]["questions"][0]["text"] = "Changed in JSON"
    summary = run_import(db, fewer)

    assert summary["research"]["answers"] == 5
    assert summary["structure"].startswith("kept")
    with Session(db) as session:
        assert session.get(Response, (code, question_id)).score == 2
        assert len(session.scalars(select(ResponseEvidence)).all()) == 1
        # Structure is the admins' once it exists - a plain re-import doesn't overwrite it.
        assert session.get(Question, question_id).text == files["protocol"]["questions"][0]["text"]
        assert len(session.scalars(select(AuditLog)).all()) == 2


@needs_db
def test_overwrite_structure_updates_but_wont_delete_what_people_point_at(db, files):
    run_import(db, files)
    changed = copy.deepcopy(files)
    changed["protocol"]["questions"][0]["text"] = "Changed in JSON"
    run_import(db, changed, overwrite_structure=True)
    question_id = files["protocol"]["questions"][0]["id"]
    with Session(db) as session:
        assert session.get(Question, question_id).text == "Changed in JSON"

    with Session(db) as session, session.begin():
        session.add(Response(country_code=files["jurisdictions"][0]["code"], question_id=question_id, score=None, updated_by="x"))
    dropped = copy.deepcopy(files)
    dropped["protocol"]["questions"] = dropped["protocol"]["questions"][1:]
    with pytest.raises(IntegrityError):
        run_import(db, dropped, overwrite_structure=True)
    with Session(db) as session:
        assert session.get(Question, question_id) is not None


@needs_db
def test_bad_data_fails_the_whole_run(db, files):
    bad = copy.deepcopy(files)
    bad["sourced"]["answers"][3]["typo"] = 1
    with pytest.raises(DataError, match="answer #3.*unknown \\['typo'\\]"):
        run_import(db, bad)
    with Session(db) as session:
        assert session.scalars(select(Jurisdiction)).first() is None
        assert session.scalars(select(AuditLog)).first() is None


@needs_db
def test_cli_check_exit_codes(db, files, capsys):
    assert import_json.main(["--check"]) == 2  # nothing imported yet
    assert import_json.main(["--actor", "test"]) == 0
    assert import_json.main(["--check"]) == 0


@needs_db
def test_migration_downgrades_cleanly(db):
    config = Config(str(HERE / "alembic.ini"))
    command.downgrade(config, "base")
    with db.connect() as conn:
        tables = conn.execute(text("SELECT count(*) FROM pg_tables WHERE schemaname = 'policy'")).scalar()
    assert tables == 1  # only alembic_version
    command.upgrade(config, "head")


@needs_db
def test_export_shape_matches_what_the_frontend_imports(db, files):
    run_import(db, files)
    with Session(db) as session:
        exported = export_all(session)
    assert set(exported) == {"protocol", "jurisdictions", "sourced", "indicator"}
    assert set(exported["protocol"]["questions"][0]) == set(files["protocol"]["questions"][0])
