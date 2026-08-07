"""users table for authentication

Revision ID: 0004_users_and_auth
Revises: 0003_drop_task_status
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0004_users_and_auth"
down_revision: Union[str, None] = "0003_drop_task_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    citext_available = bind.execute(
        sa.text(
            "SELECT 1 FROM pg_available_extensions WHERE name = 'citext'"
        )
    ).scalar() is not None

    if citext_available:
        op.execute("CREATE EXTENSION IF NOT EXISTS citext")
        username_type = postgresql.CITEXT()
        email_type = postgresql.CITEXT()
    else:
        username_type = sa.Text()
        email_type = sa.Text()

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("username", username_type, nullable=False),
        sa.Column("email", email_type, nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("mobile_number", sa.Text(), nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
