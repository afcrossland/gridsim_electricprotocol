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


# --- GET /api/policy/data ----------------------------------------------------------------------


@pytest.fixture
def api_client():
    from fastapi.testclient import TestClient

    import main

    return TestClient(main.app)


def test_api_without_a_database_is_unavailable(api_client, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    r = api_client.get("/api/policy/data")
    assert r.status_code == 503
    assert r.headers["cache-control"] == "no-store"


@needs_db
def test_api_on_an_empty_database_is_unavailable(db, api_client):
    r = api_client.get("/api/policy/data")
    assert r.status_code == 503
    assert "run the import" in r.json()["error"]


@needs_db
def test_api_serves_exactly_what_the_files_hold(db, files, api_client):
    run_import(db, files)
    r = api_client.get("/api/policy/data")
    assert r.status_code == 200
    assert "public" in r.headers["cache-control"]
    expected = {**files, **{o: {k: v for k, v in files[o].items() if k != "README"} for o in ("sourced", "indicator")}}
    body = r.json()
    assert body.pop("responses") == []  # nobody has edited anything yet
    assert differences(expected, body) == []


def test_api_needs_no_klute_sign_in(api_client, monkeypatch):
    # The gate's /klute routes all require a session; this one must not.
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert api_client.get("/api/policy/data").status_code != 401


def test_ep_db_imports_without_the_repo_around_it():
    # The gate's image holds ep_db at /app/ep_db with no repo above it, and main.py imports the API
    # from it at startup. Reading a repo path at import time there once crashed the whole gate, so
    # import it with __file__ paths resolving as they do in the image.
    import subprocess
    import sys

    fake_image_paths = (
        "import pathlib\n"
        "real = pathlib.Path.resolve\n"
        "def resolve(self, *a, **k):\n"
        "    p = real(self, *a, **k)\n"
        "    return pathlib.Path('/app/ep_db', p.name) if p.parent.name == 'ep_db' else p\n"
        "pathlib.Path.resolve = resolve\n"
        "import ep_db.api\n"
    )
    result = subprocess.run([sys.executable, "-c", fake_image_paths], cwd=HERE, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


# --- Sign-in (Phase 2) -------------------------------------------------------------------------


@pytest.fixture
def signed_in(monkeypatch):
    """Stand-in for Firebase: a token "ok:<email>" verifies as that (verified) email."""
    from ep_db import auth

    def fake_verify(token):
        if not token.startswith("ok:"):
            raise ValueError("bad token")
        return {"email": token[3:], "email_verified": True}

    monkeypatch.setattr(auth, "verify_firebase_token", fake_verify)
    monkeypatch.setenv("POLICY_EDITOR_EMAILS", "Ed@Example.org, other@example.org")
    return lambda email: {"Authorization": f"Bearer ok:{email}"}


def test_me_needs_a_sign_in(api_client, signed_in):
    assert api_client.get("/api/policy/me").status_code == 401
    assert api_client.get("/api/policy/me", headers={"Authorization": "Bearer forged"}).status_code == 401


def test_me_only_admits_listed_editors(api_client, signed_in):
    r = api_client.get("/api/policy/me", headers=signed_in("ed@example.org"))
    assert r.status_code == 200 and r.json() == {"email": "ed@example.org"}
    assert api_client.get("/api/policy/me", headers=signed_in("stranger@example.org")).status_code == 403


def test_unverified_email_is_not_an_editor(api_client, monkeypatch):
    from ep_db import auth

    monkeypatch.setattr(auth, "verify_firebase_token", lambda t: {"email": "ed@example.org", "email_verified": False})
    monkeypatch.setenv("POLICY_EDITOR_EMAILS", "ed@example.org")
    assert api_client.get("/api/policy/me", headers={"Authorization": "Bearer x"}).status_code == 403


def test_no_editor_list_means_no_editors(api_client, signed_in, monkeypatch):
    monkeypatch.delenv("POLICY_EDITOR_EMAILS")
    assert api_client.get("/api/policy/me", headers=signed_in("ed@example.org")).status_code == 403


def test_auth_config(api_client, monkeypatch):
    for name in ("FIREBASE_API_KEY", "FIREBASE_AUTH_DOMAIN", "FIREBASE_PROJECT_ID"):
        monkeypatch.delenv(name, raising=False)
    assert api_client.get("/api/policy/auth-config").status_code == 503
    monkeypatch.setenv("FIREBASE_API_KEY", "k")
    monkeypatch.setenv("FIREBASE_AUTH_DOMAIN", "p.firebaseapp.com")
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "p")
    assert api_client.get("/api/policy/auth-config").json() == {"apiKey": "k", "authDomain": "p.firebaseapp.com", "projectId": "p"}


# --- Editors' writes (Phase 4) -----------------------------------------------------------------


@pytest.fixture
def editor(db, files, api_client, signed_in):
    """A loaded database and a client signed in as an editor."""
    run_import(db, files)
    headers = signed_in("ed@example.org")
    question = files["protocol"]["questions"][0]
    return api_client, headers, question


def audit_rows(db):
    with Session(db) as session:
        return session.scalars(select(AuditLog).where(AuditLog.entity != "import").order_by(AuditLog.id)).all()


@needs_db
def test_writes_need_an_editor(editor):
    client, _, question = editor
    body = {"score": 1, "evidence": []}
    assert client.put(f"/api/policy/responses/AT/{question['id']}", json=body).status_code == 401
    stranger = {"Authorization": "Bearer ok:stranger@example.org"}
    assert client.put(f"/api/policy/responses/AT/{question['id']}", json=body, headers=stranger).status_code == 403
    assert client.delete(f"/api/policy/questions/{question['id']}", headers=stranger).status_code == 403


@needs_db
def test_put_response_saves_shows_and_audits(db, editor):
    client, headers, question = editor
    url = f"/api/policy/responses/AT/{question['id']}"
    body = {"score": 2, "basis": "national", "evidence": [{"title": "Act", "source": "https://x", "note": "n"}]}
    assert client.put(url, json=body, headers=headers).status_code == 200

    served = [r for r in client.get("/api/policy/data").json()["responses"] if r["countryCode"] == "AT"]
    assert len(served) == 1
    assert served[0] | {"updatedAt": None} == {
        "countryCode": "AT", "questionId": question["id"], "score": 2, "basis": "national",
        "evidence": body["evidence"], "updatedAt": None, "updatedBy": "ed@example.org",
    }
    [row] = audit_rows(db)
    assert (row.actor, row.entity, row.entity_key, row.before, row.after["score"]) == (
        "ed@example.org", "response", f"AT/{question['id']}", None, 2)

    # Clearing an answer is kept as a row with no score, so it overrides the researched answer.
    assert client.put(url, json={"score": None, "evidence": []}, headers=headers).status_code == 200
    [cleared] = [r for r in client.get("/api/policy/data").json()["responses"] if r["countryCode"] == "AT"]
    assert cleared["score"] is None and cleared["evidence"] == []
    assert audit_rows(db)[-1].before["score"] == 2


@needs_db
def test_put_response_rejects_bad_input(editor):
    client, headers, question = editor
    put = lambda url, body: client.put(url, json=body, headers=headers).status_code
    assert put(f"/api/policy/responses/AT/{question['id']}", {"score": 99, "evidence": []}) == 422
    assert put(f"/api/policy/responses/AT/{question['id']}", {"score": 1, "basis": "vibes"}) == 422
    assert put(f"/api/policy/responses/XX/{question['id']}", {"score": 1}) == 404
    assert put("/api/policy/responses/AT/no-such-question", {"score": 1}) == 404


@needs_db
def test_questions_and_sections_round_trip(db, editor):
    client, headers, question = editor
    section = {"title": "New area", "order": 99}
    assert client.put("/api/policy/sections/s-new", json=section, headers=headers).status_code == 200
    new_q = {"sectionId": "s-new", "subsection": None, "order": 99, "text": "Is it new?", "weight": 2,
             "rubric": [{"score": 0, "label": "No", "points": 0}, {"score": 2, "label": "Yes", "points": 4}]}
    assert client.put("/api/policy/questions/q-new", json=new_q, headers=headers).status_code == 200
    edited = {**{k: question[k] for k in ("sectionId", "subsection", "order", "weight", "rubric")}, "text": "Reworded"}
    assert client.put(f"/api/policy/questions/{question['id']}", json=edited, headers=headers).status_code == 200
    assert client.put("/api/policy/protocol", json={"completenessThreshold": 0.5}, headers=headers).status_code == 200

    protocol = client.get("/api/policy/data").json()["protocol"]
    by_id = {q["id"]: q for q in protocol["questions"]}
    assert by_id["q-new"]["rubric"][1] == {"score": 2, "label": "Yes", "points": 4.0}
    assert by_id[question["id"]]["text"] == "Reworded"
    assert {"id": "s-new", "title": "New area", "order": 99} in protocol["sections"]
    assert protocol["completenessThreshold"] == 0.5

    # Deleting the section takes its question - and that question's answers - with it.
    client.put("/api/policy/responses/AT/q-new", json={"score": 2}, headers=headers)
    assert client.delete("/api/policy/sections/s-new", headers=headers).status_code == 200
    data = client.get("/api/policy/data").json()
    assert "q-new" not in {q["id"] for q in data["protocol"]["questions"]}
    assert not [r for r in data["responses"] if r["questionId"] == "q-new"]
    assert [(r.entity, r.action) for r in audit_rows(db)][-3:] == [("response", "delete"), ("question", "delete"), ("section", "delete")]
    # Deletes are idempotent.
    assert client.delete("/api/policy/sections/s-new", headers=headers).status_code == 200


@needs_db
def test_put_question_rejects_bad_input(editor):
    client, headers, question = editor
    base = {k: question[k] for k in ("sectionId", "subsection", "order", "text", "weight", "rubric")}
    put = lambda body: client.put(f"/api/policy/questions/{question['id']}", json=body, headers=headers).status_code
    assert put({**base, "sectionId": "nope"}) == 404
    assert put({**base, "rubric": [{"score": 1, "label": "a", "points": 0}, {"score": 1, "label": "b", "points": 1}]}) == 422
    assert put({**base, "rubric": []}) == 422
    assert put({**base, "text": ""}) == 422


@needs_db
def test_research_reimport_keeps_editors_work(db, files, editor):
    client, headers, question = editor
    client.put(f"/api/policy/responses/AT/{question['id']}", json={"score": 0}, headers=headers)
    edited = {**{k: question[k] for k in ("sectionId", "subsection", "order", "weight", "rubric")}, "text": "Reworded"}
    client.put(f"/api/policy/questions/{question['id']}", json=edited, headers=headers)
    run_import(db, files)  # what import-input.yml does now: no --overwrite-structure
    data = client.get("/api/policy/data").json()
    assert {q["id"]: q["text"] for q in data["protocol"]["questions"]}[question["id"]] == "Reworded"
    assert [r["score"] for r in data["responses"] if r["countryCode"] == "AT"] == [0]
    with Session(db) as session:
        assert check(session, files, research_only=True) == []
