from __future__ import annotations
import os
import socket
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Iterator, Tuple
from urllib.parse import urlparse

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


TEST_DB_URL = os.environ.setdefault(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://flowboard:flowboard@localhost:5432/flowboard_test",
)
TEST_REDIS_URL = os.environ.setdefault(
    "TEST_REDIS_URL", "redis://localhost:6379/15"
)

os.environ.setdefault("JWT_SECRET", "unit-test-secret-do-not-use")


def _tcp_up(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def _parse_hostport(url: str, default_port: int) -> Tuple[str, int]:
    parsed = urlparse(url.replace("+asyncpg", ""))
    return parsed.hostname or "localhost", parsed.port or default_port


_pg_host, _pg_port = _parse_hostport(TEST_DB_URL, 5432)
_redis_host, _redis_port = _parse_hostport(TEST_REDIS_URL, 6379)

PG_AVAILABLE = _tcp_up(_pg_host, _pg_port)
REDIS_AVAILABLE = _tcp_up(_redis_host, _redis_port)


def _skip_reason() -> str | None:
    missing = []
    if not PG_AVAILABLE:
        missing.append(f"Postgres at {_pg_host}:{_pg_port}")
    if not REDIS_AVAILABLE:
        missing.append(f"Redis at {_redis_host}:{_redis_port}")
    if missing:
        return "Skipping integration tests: " + ", ".join(missing) + " unreachable"
    return None


collect_ignore_glob: list[str] = []
_skip = _skip_reason()
if _skip:
    collect_ignore_glob.extend(["test_auth.py", "test_ownership.py"])


if not _skip:
    os.environ["DATABASE_URL"] = TEST_DB_URL
    os.environ["REDIS_URL"] = TEST_REDIS_URL
    from app.config import get_settings

    get_settings.cache_clear()


@pytest.fixture(scope="session")
def _migrated_db() -> Iterator[None]:
    if _skip:
        pytest.skip(_skip)

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
        cwd=str(_BACKEND_ROOT),
        env={**os.environ, "DATABASE_URL": TEST_DB_URL},
    )
    if result.returncode != 0:
        pytest.skip(
            f"Could not run alembic upgrade head on test DB:\n{result.stderr}"
        )
    yield


@pytest.fixture()
def clean_db(_migrated_db) -> Iterator[None]:
    import asyncio
    import asyncpg
    import redis.asyncio as aioredis
    from urllib.parse import urlparse

    parsed = urlparse(TEST_DB_URL.replace("+asyncpg", ""))

    async def _reset():
        conn = await asyncpg.connect(
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            database=parsed.path.lstrip("/"),
            timeout=5,
        )
        try:
            await conn.execute(
                "TRUNCATE TABLE habit_logs, habit_streaks, habits, "
                "task_comments, tasks, sections, users "
                "RESTART IDENTITY CASCADE"
            )
        finally:
            await conn.close()

        r = aioredis.from_url(TEST_REDIS_URL, socket_timeout=3)
        try:
            await r.flushdb()
        finally:
            await r.aclose()

    asyncio.run(_reset())

    from app.database import engine

    asyncio.run(engine.dispose())

    yield


@pytest.fixture()
def client(clean_db):
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as tc:
        yield tc


def _unique(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _register_user(tc) -> dict:
    username = _unique("user")
    email = f"{username}@example.com"
    payload = {
        "username": username,
        "email": email,
        "password": "correct-horse-battery-staple",
        "mobile_number": "+911234567890",
    }
    resp = tc.post("/api/auth/register", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return {
        "credentials": payload,
        "user": body["user"],
        "access_token": body["access_token"],
        "refresh_token": body["refresh_token"],
        "auth_headers": {"Authorization": f"Bearer {body['access_token']}"},
    }


@pytest.fixture()
def user_a(client) -> dict:
    return _register_user(client)


@pytest.fixture()
def user_b(client) -> dict:
    return _register_user(client)
