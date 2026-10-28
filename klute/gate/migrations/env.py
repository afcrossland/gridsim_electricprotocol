"""Alembic environment. Everything lives in the `policy` schema, including Alembic's own
version table, so the database's `public` schema is left alone."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, text

from ep_db.db import database_url
from ep_db.models import SCHEMA, Base

if context.config.config_file_name:
    fileConfig(context.config.config_file_name)


def run_migrations_online() -> None:
    engine = create_engine(database_url())
    with engine.begin() as connection:
        connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
        context.configure(
            connection=connection,
            target_metadata=Base.metadata,
            version_table_schema=SCHEMA,
            include_schemas=True,
            include_name=lambda name, type_, _: type_ != "schema" or name == SCHEMA,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    raise SystemExit("Offline mode isn't set up; run against a database (DATABASE_URL).")
run_migrations_online()
