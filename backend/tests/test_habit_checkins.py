"""Calendar-day check-ins must follow the caller's timezone, not UTC midnight."""

import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.database import get_db
from app.deps import get_current_user
from app.routers import habits
from app.schemas.habit import HabitLogToggle
from app.services import habit_service


@pytest.fixture
def checkin_client(monkeypatch):
    # Route tests deliberately replace auth/DB dependencies: no real accounts,
    # database truncation, migrations, or Redis calls are needed.
    app = FastAPI()
    app.include_router(habits.router)
    db = object()
    user = SimpleNamespace(id=uuid.uuid4())
    service = AsyncMock(return_value=True)

    async def fake_db():
        yield db

    async def fake_user():
        return user

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = fake_user
    monkeypatch.setattr(habit_service, "toggle_log", service)
    with TestClient(app) as client:
        yield client, service, db, user


def freeze_utc(monkeypatch, instant):
    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return instant.astimezone(tz) if tz else instant.replace(tzinfo=None)

    monkeypatch.setattr(habits, "datetime", FrozenDatetime)


@pytest.mark.parametrize(
    "utc_now,offset,log_date,expected_status",
    [
        (datetime(2026, 11, 22, 19, tzinfo=timezone.utc), -330, "2026-11-23", 200),
        (datetime(2026, 11, 22, 19, tzinfo=timezone.utc), -330, "2026-11-24", 400),
        (datetime(2026, 11, 23, 1, tzinfo=timezone.utc), 480, "2026-11-22", 200),
        (datetime(2026, 11, 23, 1, tzinfo=timezone.utc), 480, "2026-11-23", 400),
        (datetime(2026, 12, 31, 12, tzinfo=timezone.utc), -840, "2027-01-01", 200),
        (datetime(2027, 1, 1, 8, tzinfo=timezone.utc), 720, "2026-12-31", 200),
        (datetime(2026, 11, 22, 19, tzinfo=timezone.utc), -345, "2026-11-23", 200),
        (datetime(2026, 11, 22, 19, tzinfo=timezone.utc), 0, "2026-11-22", 200),
        (datetime(2026, 11, 22, 19, tzinfo=timezone.utc), 0, "2026-11-23", 400),
        (datetime(2026, 11, 22, 19, tzinfo=timezone.utc), -330, "2026-10-01", 200),
    ],
)
def test_checkin_uses_client_calendar_day(
    checkin_client, monkeypatch, utc_now, offset, log_date, expected_status
):
    client, service, _, _ = checkin_client
    freeze_utc(monkeypatch, utc_now)
    response = client.post(
        f"/api/habits/{uuid.uuid4()}/logs",
        json={"date": log_date, "timezone_offset_minutes": offset},
    )
    assert response.status_code == expected_status, response.text
    if expected_status == 200:
        assert response.json() == {"logged": True, "date": log_date}
        service.assert_awaited_once()
    else:
        assert response.json()["detail"] == "Cannot log a future date"
        service.assert_not_awaited()


def test_local_today_is_forwarded_to_streak_calculation(checkin_client, monkeypatch):
    client, service, db, user = checkin_client
    freeze_utc(monkeypatch, datetime(2026, 11, 22, 19, tzinfo=timezone.utc))
    habit_id = uuid.uuid4()
    response = client.post(
        f"/api/habits/{habit_id}/logs",
        json={"date": "2026-11-23", "timezone_offset_minutes": -330},
    )
    assert response.status_code == 200, response.text
    service.assert_awaited_once_with(
        db, habit_id, user.id, date(2026, 11, 23), today=date(2026, 11, 23)
    )


def test_legacy_clients_default_to_utc(checkin_client, monkeypatch):
    client, service, _, _ = checkin_client
    freeze_utc(monkeypatch, datetime(2026, 11, 22, 19, tzinfo=timezone.utc))
    response = client.post(
        f"/api/habits/{uuid.uuid4()}/logs", json={"date": "2026-11-22"}
    )
    assert response.status_code == 200, response.text
    assert service.await_args.kwargs["today"] == date(2026, 11, 22)


def test_missing_habit_still_returns_not_found(checkin_client, monkeypatch):
    client, service, _, _ = checkin_client
    freeze_utc(monkeypatch, datetime(2026, 11, 22, 19, tzinfo=timezone.utc))
    service.return_value = None
    response = client.post(
        f"/api/habits/{uuid.uuid4()}/logs",
        json={"date": "2026-11-23", "timezone_offset_minutes": -330},
    )
    assert response.status_code == 404, response.text


@pytest.mark.parametrize("offset", [-841, 841])
def test_invalid_timezone_offset_is_rejected(offset):
    with pytest.raises(ValidationError):
        HabitLogToggle(date="2026-11-23", timezone_offset_minutes=offset)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "local_today,dates",
    [
        (date(2026, 11, 23), [date(2026, 11, 23), date(2026, 11, 22)]),
        (date(2026, 11, 22), [date(2026, 11, 22), date(2026, 11, 21)]),
    ],
)
async def test_streak_uses_the_same_local_day(monkeypatch, local_today, dates):
    row = SimpleNamespace(current_streak=0, longest_streak=0, last_logged=None)
    db = AsyncMock()
    db.execute.side_effect = [
        SimpleNamespace(all=lambda: [(day,) for day in dates]),
        SimpleNamespace(scalar_one_or_none=lambda: row),
    ]
    monkeypatch.setattr(habit_service, "_invalidate_streaks_cache", AsyncMock())
    await habit_service._update_streak(db, uuid.uuid4(), uuid.uuid4(), today=local_today)
    assert row.current_streak == 2
    assert row.longest_streak == 2
    assert row.last_logged == dates[0]
