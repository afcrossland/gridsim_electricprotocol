"""The Policy Explorer's API (ROADMAP.md, Phases 1-2).

GET /api/policy/data returns the four `src/data/` files' shapes, rebuilt from the database by
`export_all` - the same function `import_json --check` compares against the files - as
{"protocol", "jurisdictions", "sourced", "indicator"}, plus "responses": the answers editors have
set in the app (Phase 4), which take precedence over researched ones for the same pair. Firebase Hosting rewrites /api/policy/**
here. It is public: it serves what the site's bundle already ships to every visitor.

Any problem answers 503, never partial data: the frontend then falls back to its bundled JSON.

Sign-in (Phase 2): /api/policy/auth-config gives the browser the public Firebase web config it
signs in with, and /api/policy/me says whether that sign-in may edit (ep_db/auth.py).
"""

import logging
import os
from functools import lru_cache

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import Engine, create_engine, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ep_db.auth import Editor
from ep_db.import_json import DataError, export_all
from ep_db.models import Response, ResponseEvidence

log = logging.getLogger(__name__)
router = APIRouter()

# Short enough that a re-import shows up within minutes; Firebase's CDN honours s-maxage.
CACHEABLE = {"Cache-Control": "public, max-age=60, s-maxage=300"}
NO_STORE = {"Cache-Control": "no-store"}


@lru_cache(maxsize=1)
def _engine(url: str) -> Engine:
    # Cloud Run scales the gate to 2 instances at most; keep each one's share of the shared
    # Cloud SQL instance's connections small.
    return create_engine(url, pool_size=2, max_overflow=2, pool_pre_ping=True)


def database_url_or_503() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise HTTPException(503, "The policy database isn't configured here.")
    return url


def edited_responses(session: Session) -> list[dict]:
    """Editors' answers in the frontend's Response shape; score None means they cleared it."""
    evidence: dict[tuple[str, str], list[dict]] = {}
    for e in session.scalars(select(ResponseEvidence).order_by(ResponseEvidence.position)):
        evidence.setdefault((e.country_code, e.question_id), []).append({"title": e.title, "source": e.source, "note": e.note})
    return [
        {
            "countryCode": r.country_code,
            "questionId": r.question_id,
            "score": r.score,
            "basis": r.basis,
            "evidence": evidence.get((r.country_code, r.question_id), []),
            "updatedAt": r.updated_at.isoformat(),
            "updatedBy": r.updated_by,
        }
        for r in session.scalars(select(Response).order_by(Response.country_code, Response.question_id))
    ]


def _unavailable(message: str) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=503, headers=NO_STORE)


@router.get("/api/policy/data")
def policy_data() -> JSONResponse:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        return _unavailable("The policy database isn't configured here.")
    try:
        with Session(_engine(url)) as session:
            data = export_all(session)
            data["responses"] = edited_responses(session)
    except DataError as e:
        return _unavailable(str(e))
    except SQLAlchemyError:
        log.exception("policy database read failed")
        return _unavailable("The policy database couldn't be read.")
    return JSONResponse(data, headers=CACHEABLE)


@router.get("/api/policy/auth-config")
def auth_config() -> JSONResponse:
    """Firebase's web config is public by design (it names the project; it grants nothing)."""
    config = {
        "apiKey": os.environ.get("FIREBASE_API_KEY", ""),
        "authDomain": os.environ.get("FIREBASE_AUTH_DOMAIN", ""),
        "projectId": os.environ.get("FIREBASE_PROJECT_ID", ""),
    }
    if not all(config.values()):
        return _unavailable("Sign-in isn't configured here.")
    return JSONResponse(config, headers=CACHEABLE)


@router.get("/api/policy/me")
def me(email: str = Editor) -> JSONResponse:
    """200 with the email for a signed-in editor; 401/403 otherwise (see require_editor)."""
    return JSONResponse({"email": email}, headers=NO_STORE)
