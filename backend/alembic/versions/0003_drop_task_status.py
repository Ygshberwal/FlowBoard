"""drop tasks.status legacy column

Revision ID: 0003_drop_task_status
Revises: 0002_sections
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0003_drop_task_status"
down_revision: Union[str, None] = "0002_sections"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_tasks_status", table_name="tasks")
    op.drop_column("tasks", "status")


def downgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="pending",
        ),
    )
    op.create_index("ix_tasks_status", "tasks", ["status"])
