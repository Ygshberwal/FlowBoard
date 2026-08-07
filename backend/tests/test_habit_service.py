import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace

from app.services.habit_service import _streak_to_payload


def test_streak_to_payload_serializes_all_fields():
    row = SimpleNamespace(
        habit_id=uuid.UUID("12345678-1234-5678-1234-567812345678"),
        current_streak=5,
        longest_streak=10,
        last_logged=date(2024, 1, 15),
        updated_at=datetime(2024, 1, 16, 12, 0, 0, tzinfo=timezone.utc),
    )
    assert _streak_to_payload(row) == {
        "habit_id": "12345678-1234-5678-1234-567812345678",
        "current_streak": 5,
        "longest_streak": 10,
        "last_logged": "2024-01-15",
        "updated_at": "2024-01-16T12:00:00+00:00",
    }


def test_streak_to_payload_handles_null_last_logged():
    row = SimpleNamespace(
        habit_id=uuid.uuid4(),
        current_streak=0,
        longest_streak=0,
        last_logged=None,
        updated_at=datetime.now(timezone.utc),
    )
    payload = _streak_to_payload(row)
    assert payload["last_logged"] is None
    assert payload["current_streak"] == 0
