import pytest
from pydantic import ValidationError

from app.schemas.task import TaskCreate, TaskUpdate, TaskCounts
from app.schemas.habit import HabitLogsResponse, HabitCreate


def test_task_create_defaults():
    t = TaskCreate(title="Buy milk")
    assert t.title == "Buy milk"
    assert t.section_id is None
    assert t.priority == "medium"


def test_task_create_rejects_missing_title():
    with pytest.raises(ValidationError):
        TaskCreate()


def test_task_status_field_removed():
    fields = TaskCreate.model_fields
    assert "status" not in fields
    assert "status" not in TaskUpdate.model_fields


def test_task_counts_only_today_and_week():
    counts = TaskCounts()
    payload = counts.model_dump()
    assert payload == {"today": 0, "week": 0}


def test_habit_logs_response_accepts_iso_dates():
    payload = HabitLogsResponse(logs={"habit-a": ["2024-01-01", "2024-02-29"]})
    assert payload.logs["habit-a"] == ["2024-01-01", "2024-02-29"]


def test_habit_create_defaults():
    h = HabitCreate(name="Read")
    assert h.color == "#1D9E75"
    assert h.sort_order == 0
    assert h.category is None
