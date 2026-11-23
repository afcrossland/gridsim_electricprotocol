"""deployment explorer data in its own schema

The Deployment Explorer's Ember solar capacity, Ember generation and World Bank population data
(deployment/src/data/*.json), loaded by `python -m ep_db.deployment_import`. Same database and
user as the policy tables; a separate `deployment` schema keeps the two apart.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

S = "deployment"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {S}")
    op.create_table(
        "datasets",
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("source", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("fetched_at", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("imported_by", sa.Text(), nullable=False),
        sa.CheckConstraint("name IN ('solar', 'generation', 'population')", name=op.f("ck_datasets_name")),
        sa.PrimaryKeyConstraint("name", name=op.f("pk_datasets")),
        schema=S,
    )
    op.create_table(
        "solar_countries",
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("granularity", sa.Text(), nullable=False),
        sa.CheckConstraint("granularity IN ('monthly', 'annual')", name=op.f("ck_solar_countries_granularity")),
        sa.PrimaryKeyConstraint("code", name=op.f("pk_solar_countries")),
        sa.UniqueConstraint("position", name=op.f("uq_solar_countries_position")),
        schema=S,
    )
    op.create_table(
        "solar_monthly",
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("gw", sa.Float(), nullable=False),
        sa.CheckConstraint("month BETWEEN 1 AND 12", name=op.f("ck_solar_monthly_month")),
        sa.ForeignKeyConstraint(["code"], [f"{S}.solar_countries.code"], name=op.f("fk_solar_monthly_code"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("code", "year", "month", name=op.f("pk_solar_monthly")),
        schema=S,
    )
    op.create_table(
        "solar_annual",
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("gw", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["code"], [f"{S}.solar_countries.code"], name=op.f("fk_solar_annual_code"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("code", "year", name=op.f("pk_solar_annual")),
        schema=S,
    )
    op.create_table(
        "generation_countries",
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("code", name=op.f("pk_generation_countries")),
        sa.UniqueConstraint("position", name=op.f("uq_generation_countries_position")),
        schema=S,
    )
    op.create_table(
        "generation_yearly",
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("solar_twh", sa.Float(), nullable=False),
        sa.Column("total_twh", sa.Float(), nullable=False),
        sa.Column("share_pct", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(
            ["code"], [f"{S}.generation_countries.code"], name=op.f("fk_generation_yearly_code"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("code", "year", name=op.f("pk_generation_yearly")),
        schema=S,
    )
    op.create_table(
        "population",
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("population_millions", sa.Float(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("code", name=op.f("pk_population")),
        sa.UniqueConstraint("position", name=op.f("uq_population_position")),
        schema=S,
    )


def downgrade() -> None:
    op.execute(f"DROP SCHEMA IF EXISTS {S} CASCADE")
