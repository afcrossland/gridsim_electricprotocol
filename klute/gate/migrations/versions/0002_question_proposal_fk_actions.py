"""question proposals follow their section and question on delete

Deleting a section (with its questions) or a question in the admin console failed on
question_proposals' foreign keys: a proposal now goes with its section, and one whose
question is deleted is kept with no link.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-21
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _replace(column: str, target: str, ondelete: str | None) -> None:
    name = f"fk_question_proposals_{column}"
    op.drop_constraint(name, "question_proposals", type_="foreignkey", schema="policy")
    op.create_foreign_key(
        name, "question_proposals", target, [column], ["id"],
        source_schema="policy", referent_schema="policy", ondelete=ondelete,
    )


def upgrade() -> None:
    _replace("section_id", "sections", "CASCADE")
    _replace("question_id", "questions", "SET NULL")


def downgrade() -> None:
    _replace("section_id", "sections", None)
    _replace("question_id", "questions", None)
