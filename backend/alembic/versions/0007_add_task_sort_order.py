"""add persisted task ordering

Revision ID: 0007_add_task_sort_order
Revises: 0006_user_token_version
Create Date: 2026-09-06 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0007_add_task_sort_order"
down_revision: Union[str, None] = "0006_user_token_version"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("sort_order", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "sort_order")
