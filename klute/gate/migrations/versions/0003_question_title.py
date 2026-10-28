"""questions gain a short title

A few words naming each question, shown on its card in place of the full sentence (which opens on
click). Nullable: a question without one keeps showing its full text.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("title", sa.Text(), nullable=True), schema="policy")


def downgrade() -> None:
    op.drop_column("questions", "title", schema="policy")
