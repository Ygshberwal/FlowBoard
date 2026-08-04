from __future__ import annotations
import uuid
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.models.task import Task, TaskComment
from app.schemas.task import TaskCreate, TaskUpdate, TaskCounts


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _utc_day_bounds(day: date) -> Tuple[datetime, datetime]:
    start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


async def _load_task(db: AsyncSession, task_id: uuid.UUID) -> Optional[Task]:
    """Always load task with comments eagerly."""
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.comments))
        .where(Task.id == task_id)
    )
    return result.scalar_one_or_none()


async def get_tasks_by_view(db: AsyncSession, view: str) -> List[Task]:
    today = _today_utc()
    now = _now_utc()
    week_end = now + timedelta(days=7)
    day_start, day_end = _utc_day_bounds(today)

    stmt = select(Task).options(selectinload(Task.comments))

    if view == "today":
        stmt = stmt.where(
            and_(
                Task.done.is_(False),
                or_(
                    Task.scheduled_for == today,
                    and_(Task.deadline >= day_start, Task.deadline < day_end),
                )
            )
        )
    elif view == "week":
        stmt = stmt.where(
            and_(
                Task.done.is_(False),
                Task.deadline.isnot(None),
                Task.deadline >= now,
                Task.deadline <= week_end,
            )
        )
    else:
        return []

    stmt = stmt.order_by(Task.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_tasks_by_section(db: AsyncSession, section_id: uuid.UUID) -> List[Task]:
    stmt = (
        select(Task)
        .options(selectinload(Task.comments))
        .where(Task.section_id == section_id)
        .order_by(Task.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_all_tasks(db: AsyncSession) -> List[Task]:
    stmt = (
        select(Task)
        .options(selectinload(Task.comments))
        .order_by(Task.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_task_counts(db: AsyncSession) -> TaskCounts:
    today = _today_utc()
    now = _now_utc()
    week_end = now + timedelta(days=7)
    day_start, day_end = _utc_day_bounds(today)

    today_count = await db.scalar(
        select(func.count()).select_from(Task).where(
            and_(
                Task.done.is_(False),
                or_(
                    Task.scheduled_for == today,
                    and_(Task.deadline >= day_start, Task.deadline < day_end),
                )
            )
        )
    )
    week_count = await db.scalar(
        select(func.count()).select_from(Task).where(
            and_(
                Task.done.is_(False),
                Task.deadline.isnot(None),
                Task.deadline >= now,
                Task.deadline <= week_end,
            )
        )
    )

    return TaskCounts(
        today=today_count or 0,
        week=week_count or 0,
    )


async def get_task(db: AsyncSession, task_id: uuid.UUID) -> Optional[Task]:
    return await _load_task(db, task_id)


async def create_task(db: AsyncSession, data: TaskCreate) -> Task:
    task = Task(**data.model_dump())
    db.add(task)
    await db.flush()
    # Re-load with eager comments so serialization works
    return await _load_task(db, task.id)


async def update_task(
    db: AsyncSession, task_id: uuid.UUID, data: TaskUpdate
) -> Optional[Task]:
    task = await _load_task(db, task_id)
    if not task:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    task.updated_at = _now_utc()
    await db.flush()
    return await _load_task(db, task_id)


async def delete_task(db: AsyncSession, task_id: uuid.UUID) -> bool:
    task = await _load_task(db, task_id)
    if not task:
        return False
    await db.delete(task)
    return True


async def toggle_task_done(db: AsyncSession, task_id: uuid.UUID) -> Optional[Task]:
    task = await _load_task(db, task_id)
    if not task:
        return None
    task.done = not task.done
    task.updated_at = _now_utc()
    await db.flush()
    return await _load_task(db, task_id)


async def add_comment(
    db: AsyncSession, task_id: uuid.UUID, author_name: str, body: str
) -> Optional[TaskComment]:
    task = await _load_task(db, task_id)
    if not task:
        return None
    comment = TaskComment(task_id=task_id, author_name=author_name, body=body)
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return comment
