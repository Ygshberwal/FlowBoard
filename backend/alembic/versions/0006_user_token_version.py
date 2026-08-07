"""add token_version to users for session invalidation

Revision ID: 0006_user_token_version
Revises: 0005_add_ownership
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0006_user_token_version"
down_revision: Union[str, None] = "0005_add_ownership"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
