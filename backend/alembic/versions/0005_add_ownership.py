"""add user_id ownership to sections and habits

Revision ID: 0005_add_ownership
Revises: 0004_users_and_auth
Create Date: 2026-07-07 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0005_add_ownership"
down_revision: Union[str, None] = "0004_users_and_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM habit_logs")
    op.execute("DELETE FROM habit_streaks")
    op.execute("DELETE FROM habits")
    op.execute("DELETE FROM task_comments")
    op.execute("DELETE FROM tasks")
    op.execute("DELETE FROM sections")

    op.add_column(
        "sections",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_foreign_key(
        "fk_sections_user_id",
        "sections",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_sections_user_id", "sections", ["user_id"])

    op.add_column(
        "habits",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_foreign_key(
        "fk_habits_user_id",
        "habits",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_habits_user_id", "habits", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_habits_user_id", table_name="habits")
    op.drop_constraint("fk_habits_user_id", "habits", type_="foreignkey")
    op.drop_column("habits", "user_id")
    op.drop_index("ix_sections_user_id", table_name="sections")
    op.drop_constraint("fk_sections_user_id", "sections", type_="foreignkey")
    op.drop_column("sections", "user_id")
