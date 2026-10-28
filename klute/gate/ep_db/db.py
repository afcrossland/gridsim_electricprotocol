import os

from sqlalchemy import Engine, create_engine


def database_url() -> str:
    """The policy database, e.g. postgresql+psycopg://user:pass@host/electricfutures.

    Fails closed: there is no default, so nothing can be pointed at a database by accident."""
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url


def engine() -> Engine:
    return create_engine(database_url())
