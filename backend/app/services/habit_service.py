from __future__ import annotations
import uuid
import json
import calendar
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract

from app.models.habit import Habit, HabitLog, HabitStreak
from app.schemas.habit import (
    HabitCreate, HabitUpdate,
    HabitAnalyticsItem, HabitAnalyticsResponse
)
from app.redis_client import get_redis

STREAK_TTL = 3600


def _streaks_cache_key(user_id: uuid.UUID) -> str:
    return f"streaks:user:{user_id}"


async def _invalidate_streaks_cache(user_id: uuid.UUID) -> None:
    redis = await get_redis()
    await redis.delete(_streaks_cache_key(user_id))


def _streak_to_payload(row: HabitStreak) -> Dict[str, Any]:
    return {
        "habit_id": str(row.habit_id),
        "current_streak": row.current_streak,
        "longest_streak": row.longest_streak,
        "last_logged": row.last_logged.isoformat() if row.last_logged else None,
        "updated_at": row.updated_at.isoformat(),
    }


async def get_habits(db: AsyncSession, user_id: uuid.UUID) -> List[Habit]:
    result = await db.execute(
        select(Habit)
        .where(Habit.user_id == user_id, Habit.archived == False)
        .order_by(Habit.sort_order, Habit.created_at)
    )
    return list(result.scalars().all())


async def get_habit(
    db: AsyncSession, habit_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[Habit]:
    result = await db.execute(
        select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_habit(
    db: AsyncSession, user_id: uuid.UUID, data: HabitCreate
) -> Habit:
    habit = Habit(user_id=user_id, **data.model_dump())
    db.add(habit)
    await db.flush()
    streak = HabitStreak(habit_id=habit.id)
    db.add(streak)
    await db.flush()
    await db.refresh(habit)
    await _invalidate_streaks_cache(user_id)
    return habit


async def update_habit(
    db: AsyncSession, habit_id: uuid.UUID, user_id: uuid.UUID, data: HabitUpdate
) -> Optional[Habit]:
    habit = await get_habit(db, habit_id, user_id)
    if not habit:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(habit, field, value)
    await db.flush()
    await db.refresh(habit)
    return habit


async def archive_habit(
    db: AsyncSession, habit_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    habit = await get_habit(db, habit_id, user_id)
    if not habit:
        return False
    habit.archived = True
    await db.flush()
    return True


async def toggle_log(
    db: AsyncSession, habit_id: uuid.UUID, user_id: uuid.UUID, log_date: date
) -> Optional[bool]:
    habit = await get_habit(db, habit_id, user_id)
    if not habit:
        return None

    result = await db.execute(
        select(HabitLog).where(
            and_(HabitLog.habit_id == habit_id, HabitLog.logged_on == log_date)
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        logged = False
    else:
        log = HabitLog(habit_id=habit_id, logged_on=log_date)
        db.add(log)
        logged = True

    await db.flush()
    await _update_streak(db, habit_id, user_id)
    return logged


async def get_logs_for_year(
    db: AsyncSession, user_id: uuid.UUID, year: int
) -> Dict[str, List[str]]:
    result = await db.execute(
        select(HabitLog.habit_id, HabitLog.logged_on)
        .join(Habit, Habit.id == HabitLog.habit_id)
        .where(
            Habit.user_id == user_id,
            extract("year", HabitLog.logged_on) == year,
        )
        .order_by(HabitLog.logged_on)
    )
    logs: Dict[str, List[str]] = {}
    for habit_id, logged_on in result.all():
        logs.setdefault(str(habit_id), []).append(logged_on.isoformat())
    return logs


async def get_logs_for_month(
    db: AsyncSession, user_id: uuid.UUID, year: int, month: int
) -> Dict[str, List[str]]:
    result = await db.execute(
        select(HabitLog.habit_id, HabitLog.logged_on)
        .join(Habit, Habit.id == HabitLog.habit_id)
        .where(
            Habit.user_id == user_id,
            extract("year", HabitLog.logged_on) == year,
            extract("month", HabitLog.logged_on) == month,
        )
        .order_by(HabitLog.logged_on)
    )
    logs: Dict[str, List[str]] = {}
    for habit_id, logged_on in result.all():
        logs.setdefault(str(habit_id), []).append(logged_on.isoformat())
    return logs


async def get_streaks(db: AsyncSession, user_id: uuid.UUID) -> List[Dict[str, Any]]:
    redis = await get_redis()
    cache_key = _streaks_cache_key(user_id)
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await db.execute(
        select(HabitStreak)
        .join(Habit, Habit.id == HabitStreak.habit_id)
        .where(Habit.user_id == user_id)
    )
    payload = [_streak_to_payload(r) for r in result.scalars().all()]
    await redis.setex(cache_key, STREAK_TTL, json.dumps(payload))
    return payload


async def _update_streak(
    db: AsyncSession, habit_id: uuid.UUID, user_id: uuid.UUID
):
    result = await db.execute(
        select(HabitLog.logged_on)
        .where(HabitLog.habit_id == habit_id)
        .order_by(HabitLog.logged_on.desc())
    )
    all_dates = sorted([r[0] for r in result.all()], reverse=True)

    if not all_dates:
        current = 0
        longest = 0
        last_logged = None
    else:
        today = datetime.now(timezone.utc).date()
        current = 0
        check = today
        for d in all_dates:
            if d == check:
                current += 1
                check -= timedelta(days=1)
            elif d < check:
                break

        longest = _calc_longest(all_dates)
        last_logged = all_dates[0]

    streak_result = await db.execute(
        select(HabitStreak).where(HabitStreak.habit_id == habit_id)
    )
    streak_row = streak_result.scalar_one_or_none()

    if streak_row:
        streak_row.current_streak = current
        streak_row.longest_streak = longest
        streak_row.last_logged = last_logged
        streak_row.updated_at = datetime.now(timezone.utc)
    else:
        streak_row = HabitStreak(
            habit_id=habit_id,
            current_streak=current,
            longest_streak=longest,
            last_logged=last_logged,
        )
        db.add(streak_row)

    await db.flush()
    await _invalidate_streaks_cache(user_id)


def _calc_longest(sorted_desc_dates: list[date]) -> int:
    if not sorted_desc_dates:
        return 0
    dates = sorted(sorted_desc_dates)
    longest = 1
    current = 1
    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days == 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


async def get_habit_analytics(
    db: AsyncSession, user_id: uuid.UUID, year: int, month: int
) -> HabitAnalyticsResponse:
    days_in_month = calendar.monthrange(year, month)[1]
    habits = await get_habits(db, user_id)

    result = await db.execute(
        select(HabitLog.habit_id, func.count(HabitLog.id).label("cnt"))
        .join(Habit, Habit.id == HabitLog.habit_id)
        .where(
            Habit.user_id == user_id,
            extract("year", HabitLog.logged_on) == year,
            extract("month", HabitLog.logged_on) == month,
        )
        .group_by(HabitLog.habit_id)
    )
    log_counts = {str(r.habit_id): r.cnt for r in result.all()}

    items = []
    total_possible = len(habits) * days_in_month if habits else 1
    total_logged = 0

    for habit in habits:
        logged = log_counts.get(str(habit.id), 0)
        total_logged += logged
        pct = round(logged / days_in_month * 100, 1) if days_in_month else 0
        items.append(
            HabitAnalyticsItem(
                habit_id=habit.id,
                name=habit.name,
                color=habit.color,
                completion_pct=pct,
                logged_days=logged,
                total_days=days_in_month,
            )
        )

    overall = round(total_logged / total_possible * 100, 1) if total_possible else 0
    return HabitAnalyticsResponse(overall_pct=overall, habits=items)
