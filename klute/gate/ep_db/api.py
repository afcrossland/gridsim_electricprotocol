"""Read-only policy data for the Policy Explorer (ROADMAP.md, Phase 1).

GET /api/policy/data returns the four `src/data/` files' shapes, rebuilt from the database by
`export_all` - the same function `import_json --check` compares against the files - as
{"protocol", "jurisdictions", "sourced", "indicator"}. Firebase Hosting rewrites /api/policy/**
here. It is public: it serves what the site's bundle already ships to every visitor.

Any problem answers 503, never partial data: the frontend then falls back to its bundled JSON.
"""

import logging
import os
from functools import lru_cache

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import Engine, create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ep_db.import_json import DataError, export_all

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
    except DataError as e:
        return _unavailable(str(e))
    except SQLAlchemyError:
        log.exception("policy database read failed")
        return _unavailable("The policy database couldn't be read.")
    return JSONResponse(data, headers=CACHEABLE)
