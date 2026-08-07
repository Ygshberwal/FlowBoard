from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.deps import get_current_user
from app.models.section import Section
from app.models.task import Task
from app.models.user import User
from app.schemas.habit import HabitAnalyticsResponse
from app.services import habit_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/habits", response_model=HabitAnalyticsResponse)
async def habit_analytics(
    year: int = Query(...),
    month: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await habit_service.get_habit_analytics(db, current_user.id, year, month)


@router.get("/tasks")
async def task_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned_tasks = (
        select(Task)
        .join(Section, Section.id == Task.section_id)
        .where(Section.user_id == current_user.id)
        .subquery()
    )

    priority_result = await db.execute(
        select(owned_tasks.c.priority, func.count(owned_tasks.c.id).label("cnt"))
        .group_by(owned_tasks.c.priority)
    )
    by_priority = {row.priority: row.cnt for row in priority_result.all()}

    total = await db.scalar(select(func.count(owned_tasks.c.id)))
    done = await db.scalar(
        select(func.count(owned_tasks.c.id)).where(owned_tasks.c.done.is_(True))
    )

    return {
        "total": total or 0,
        "done": done or 0,
        "by_priority": by_priority,
    }
