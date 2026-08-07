from datetime import date, datetime, timedelta, timezone

from app.services.task_service import _utc_day_bounds


def test_utc_day_bounds_wraps_full_day():
    start, end = _utc_day_bounds(date(2024, 6, 15))
    assert start == datetime(2024, 6, 15, tzinfo=timezone.utc)
    assert end == datetime(2024, 6, 16, tzinfo=timezone.utc)
    assert end - start == timedelta(days=1)


def test_utc_day_bounds_handles_leap_day():
    start, end = _utc_day_bounds(date(2024, 2, 29))
    assert start == datetime(2024, 2, 29, tzinfo=timezone.utc)
    assert end == datetime(2024, 3, 1, tzinfo=timezone.utc)


def test_utc_day_bounds_handles_year_boundary():
    start, end = _utc_day_bounds(date(2023, 12, 31))
    assert start == datetime(2023, 12, 31, tzinfo=timezone.utc)
    assert end == datetime(2024, 1, 1, tzinfo=timezone.utc)
