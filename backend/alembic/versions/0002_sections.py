"""add sections and task.section_id

Revision ID: 0002_sections
Revises: 0001_initial
Create Date: 2026-07-04 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0002_sections"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_SECTIONS = [
    ("Today", 0, "today"),
    ("This week", 1, "week"),
    ("Ongoing", 2, "ongoing"),
    ("Pending", 3, "pending"),
    ("Free time", 4, "freetime"),
]


def upgrade() -> None:
    op.create_table(
        "sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Seed the five default sections (deterministic ids via gen_random_uuid()).
    for name, position, _status in DEFAULT_SECTIONS:
        op.execute(
            sa.text(
                "INSERT INTO sections (id, name, position) "
                "VALUES (gen_random_uuid(), :name, :position)"
            ).bindparams(name=name, position=position)
        )

    op.add_column(
        "tasks",
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tasks_section_id",
        "tasks",
        "sections",
        ["section_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_tasks_section_id", "tasks", ["section_id"])

    # Backfill: map existing task.status -> matching default section.
    for name, _position, status in DEFAULT_SECTIONS:
        op.execute(
            sa.text(
                "UPDATE tasks SET section_id = "
                "(SELECT id FROM sections WHERE name = :name LIMIT 1) "
                "WHERE status = :status"
            ).bindparams(name=name, status=status)
        )

    # status is no longer the source of truth for columns; drop the check
    # constraint so tasks can live in freely-created sections.
    op.drop_constraint("ck_tasks_status", "tasks", type_="check")


def downgrade() -> None:
    op.create_check_constraint(
        "ck_tasks_status",
        "tasks",
        "status IN ('today','week','ongoing','pending','freetime')",
    )
    op.drop_index("ix_tasks_section_id", table_name="tasks")
    op.drop_constraint("fk_tasks_section_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "section_id")
    op.drop_table("sections")
