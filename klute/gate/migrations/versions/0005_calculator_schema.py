"""solar homes calculator data in its own schema

The calculator's per-country irradiance profiles, self-sufficiency tiers and PC1 demand shape
(calculator/src/data/*.json), loaded by `python -m ep_db.calculator_import`.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

S = "calculator"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {S}")
    op.create_table(
        "irradiance",
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("tilt_deg", sa.Integer(), nullable=False),
        sa.Column("azimuth_deg", sa.Integer(), nullable=False),
        sa.Column("annual_kwh_per_kwp", sa.Float(), nullable=False),
        sa.Column("profile_w_per_wp", postgresql.ARRAY(sa.Float()), nullable=False),
        sa.PrimaryKeyConstraint("code", name=op.f("pk_irradiance")),
        sa.UniqueConstraint("position", name=op.f("uq_irradiance_position")),
        schema=S,
    )
    op.create_table(
        "self_sufficiency",
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("low", sa.Integer(), nullable=False),
        sa.Column("medium", sa.Integer(), nullable=False),
        sa.Column("high", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("code", name=op.f("pk_self_sufficiency")),
        sa.UniqueConstraint("position", name=op.f("uq_self_sufficiency_position")),
        schema=S,
    )
    op.create_table(
        "demand_profiles",
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("profile", postgresql.ARRAY(sa.Float()), nullable=False),
        sa.PrimaryKeyConstraint("name", name=op.f("pk_demand_profiles")),
        schema=S,
    )


def downgrade() -> None:
    op.execute(f"DROP SCHEMA IF EXISTS {S} CASCADE")
